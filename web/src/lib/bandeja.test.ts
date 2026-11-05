import { describe, expect, it } from 'vitest';
import { aplicarEvento, ConversacionResumen, EventoMensaje, fueraDeVentana, textoDeMensaje } from './bandeja';

const conv = (id: string, extra: Partial<ConversacionResumen> = {}): ConversacionResumen => ({
  id,
  contacto: { id: 'c-' + id, nombre: 'Cliente ' + id, telefono: '519' + id },
  modo: 'ia',
  noLeidos: 0,
  ultimoMensajeEn: '2026-11-05T10:00:00.000Z',
  ultimoEntranteEn: '2026-11-05T10:00:00.000Z',
  ultimoTexto: 'hola',
  ...extra,
});

const evento = (conversacionId: string, extra: Partial<EventoMensaje['mensaje']> = {}): EventoMensaje => ({
  tipo: 'mensaje',
  conversacionId,
  mensaje: {
    id: 'm1',
    conversacionId,
    direccion: 'entrante',
    origen: 'cliente',
    tipo: 'text',
    texto: 'nuevo',
    createdAt: '2026-11-05T12:00:00.000Z',
    ...extra,
  },
});

describe('aplicarEvento', () => {
  it('evento sube la conversación y suma no leídos', () => {
    const r = aplicarEvento([conv('a'), conv('b', { noLeidos: 2 })], evento('b'), null);
    expect(r.map((c) => c.id)).toEqual(['b', 'a']);
    expect(r[0]).toMatchObject({ noLeidos: 3, ultimoTexto: 'nuevo', ultimoMensajeEn: '2026-11-05T12:00:00.000Z', ultimoEntranteEn: '2026-11-05T12:00:00.000Z' });
  });

  it('evento de la conversación abierta no suma no leídos', () => {
    const r = aplicarEvento([conv('a'), conv('b')], evento('b'), 'b');
    expect(r[0].noLeidos).toBe(0);
  });

  it('mensaje saliente no suma no leídos y pasa a humano', () => {
    const r = aplicarEvento([conv('a')], evento('a', { direccion: 'saliente', origen: 'humano' }), null);
    expect(r[0]).toMatchObject({ noLeidos: 0, modo: 'humano', ultimoEntranteEn: '2026-11-05T10:00:00.000Z' });
  });

  it('evento de conversación nueva la agrega', () => {
    const r = aplicarEvento([conv('a')], evento('z'), null);
    expect(r.map((c) => c.id)).toEqual(['z', 'a']);
    expect(r[0]).toMatchObject({ noLeidos: 1, ultimoTexto: 'nuevo', modo: 'ia' });
  });

  it('mensaje de la IA no pasa la conversación a humano', () => {
    const r = aplicarEvento([conv('a')], evento('a', { direccion: 'saliente', origen: 'ia' }), null);
    expect(r[0].modo).toBe('ia');
  });

  it('el mismo mensaje actualizado (transcripción) no suma no leídos otra vez', () => {
    const una = aplicarEvento([conv('a')], evento('a'), null);
    const dos = aplicarEvento(una, evento('a', { texto: 'transcripción' }), null);
    expect(dos[0]).toMatchObject({ noLeidos: 1, ultimoTexto: 'transcripción' });
  });

  it('cambio de modo y borrador se aplican sin reordenar', () => {
    const r = aplicarEvento(
      [conv('a'), conv('b')],
      { tipo: 'conversacion', conversacionId: 'b', modo: 'humano', borrador: 'Hola!' },
      null,
    );
    expect(r.map((c) => c.id)).toEqual(['a', 'b']);
    expect(r[1]).toMatchObject({ modo: 'humano', borrador: 'Hola!' });
  });

  it('eventos de lead o pregunta no cambian la lista', () => {
    const lista = [conv('a')];
    expect(aplicarEvento(lista, { tipo: 'pregunta', pregunta: { id: 'p', pregunta: '?' } }, null)).toBe(lista);
  });

  it('no muta la lista original', () => {
    const lista = [conv('a')];
    aplicarEvento(lista, evento('a'), null);
    expect(lista[0].noLeidos).toBe(0);
  });
});

describe('fueraDeVentana', () => {
  const ahora = new Date('2026-11-05T12:00:00.000Z');
  const hace = (h: number) => new Date(ahora.getTime() - h * 3600_000).toISOString();
  it('23 h → false', () => expect(fueraDeVentana(hace(23), ahora)).toBe(false));
  it('25 h → true', () => expect(fueraDeVentana(hace(25), ahora)).toBe(true));
  it('null → true', () => expect(fueraDeVentana(null, ahora)).toBe(true));
});

describe('textoDeMensaje', () => {
  it('sin texto muestra el tipo en castellano', () => {
    expect(textoDeMensaje({ texto: null, tipo: 'image' })).toBe('[imagen]');
    expect(textoDeMensaje({ texto: null, tipo: 'audio' })).toBe('[audio]');
    expect(textoDeMensaje({ texto: null, tipo: 'raro' })).toBe('[raro]');
    expect(textoDeMensaje({ texto: 'hola', tipo: 'image' })).toBe('hola');
  });
});
