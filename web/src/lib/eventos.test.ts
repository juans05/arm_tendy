import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { conectarEventos, FuenteEventos } from './eventos';

class Falsa implements FuenteEventos {
  static creadas: Falsa[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  cerrada = false;
  constructor(public url: string) {
    Falsa.creadas.push(this);
  }
  close() {
    this.cerrada = true;
    this.readyState = 2;
  }
  abrir() {
    this.readyState = 1;
    this.onopen?.();
  }
  caer(definitivo: boolean) {
    this.readyState = definitivo ? 2 : 0;
    this.onerror?.();
  }
}

describe('conectarEventos', () => {
  let token: string | null;
  const cb = { onEvento: vi.fn(), onResync: vi.fn(), onSinSesion: vi.fn() };
  const conectar = () =>
    conectarEventos({ url: () => (token ? `/eventos?token=${token}` : null), crear: (u) => new Falsa(u), reintentoMs: 1000, ...cb });

  beforeEach(() => {
    vi.useFakeTimers();
    Falsa.creadas = [];
    token = 't1';
    Object.values(cb).forEach((f) => f.mockReset());
  });
  afterEach(() => vi.useRealTimers());

  it('entrega los eventos', () => {
    conectar();
    Falsa.creadas[0].onmessage?.({ data: '{"tipo":"mensaje","conversacionId":"c1"}' });
    expect(cb.onEvento).toHaveBeenCalledWith({ tipo: 'mensaje', conversacionId: 'c1' });
  });

  it('al reconectar sola resincroniza, pero no en la primera apertura', () => {
    conectar();
    const f = Falsa.creadas[0];
    f.abrir();
    expect(cb.onResync).not.toHaveBeenCalled();
    f.caer(false);
    f.abrir();
    expect(cb.onResync).toHaveBeenCalledTimes(1);
  });

  it('si la conexión se cierra del todo, resincroniza y abre una nueva con el token actual', () => {
    conectar();
    Falsa.creadas[0].abrir();
    token = 't2';
    Falsa.creadas[0].caer(true);
    expect(cb.onResync).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(Falsa.creadas).toHaveLength(2);
    expect(Falsa.creadas[1].url).toBe('/eventos?token=t2');
  });

  it('sin token avisa que no hay sesión', () => {
    conectar();
    token = null;
    Falsa.creadas[0].caer(true);
    vi.advanceTimersByTime(1000);
    expect(Falsa.creadas).toHaveLength(1);
    expect(cb.onSinSesion).toHaveBeenCalled();
  });

  it('cerrar detiene los reintentos', () => {
    const cerrar = conectar();
    Falsa.creadas[0].caer(true);
    cerrar();
    vi.advanceTimersByTime(5000);
    expect(Falsa.creadas).toHaveLength(1);
  });

  it('ignora mensajes que no son JSON', () => {
    conectar();
    Falsa.creadas[0].onmessage?.({ data: '' });
    expect(cb.onEvento).not.toHaveBeenCalled();
  });
});
