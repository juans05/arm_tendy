import { lastValueFrom, Subject, toArray } from 'rxjs';
import { flujoDeSesion } from './sesion-sse';

describe('flujoDeSesion', () => {
  const opts = { revisarCadaMs: 20, latidoCadaMs: 1000 };

  it('termina cuando vence el token', async () => {
    const eventos = new Subject<string>();
    const inicio = Date.now();
    const fin = lastValueFrom(
      flujoDeSesion(eventos, {
        ...opts,
        venceEn: Date.now() + 60,
        sigueActivo: async () => true,
      }).pipe(toArray()),
    );
    eventos.next('a');
    const r = await fin;
    expect(Date.now() - inicio).toBeLessThan(500);
    expect(r).toEqual([{ data: 'a' }]);
  });

  it('termina cuando el miembro deja de estar activo', async () => {
    let activo = true;
    const eventos = new Subject<string>();
    const fin = lastValueFrom(
      flujoDeSesion(eventos, {
        ...opts,
        venceEn: Date.now() + 60_000,
        sigueActivo: async () => activo,
      }).pipe(toArray()),
    );
    eventos.next('a');
    activo = false;
    await expect(fin).resolves.toEqual([{ data: 'a' }]);
  });

  it('envía latidos con nombre propio para que la conexión no quede inactiva', async () => {
    const eventos = new Subject<string>();
    const r = await lastValueFrom(
      flujoDeSesion(eventos, {
        revisarCadaMs: 1000,
        latidoCadaMs: 20,
        venceEn: Date.now() + 70,
        sigueActivo: async () => true,
      }).pipe(toArray()),
    );
    expect(r.length).toBeGreaterThanOrEqual(2);
    expect(r.every((e) => e.type === 'ping')).toBe(true);
  });

  it('sin vencimiento conocido solo corta por desactivación', async () => {
    let activo = true;
    const eventos = new Subject<string>();
    const fin = lastValueFrom(
      flujoDeSesion(eventos, {
        ...opts,
        venceEn: undefined,
        sigueActivo: async () => activo,
      }).pipe(toArray()),
    );
    setTimeout(() => (activo = false), 50);
    await expect(fin).resolves.toEqual([]);
  });
});
