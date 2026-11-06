import { describe, expect, it } from 'vitest';
import { aQuery, partesNota, vencimiento } from './actividad';

describe('actividad', () => {
  it('arma la consulta de la tabla sin parámetros vacíos', () => {
    expect(aQuery({ q: '  rosa ', etapas: ['nuevo', 'ganado'], calificado: false }, 2, 10)).toBe(
      'q=rosa&etapas=nuevo%2Cganado&calificado=false&pagina=2&porPagina=10',
    );
    expect(aQuery({ q: ' ', etapas: [] })).toBe('pagina=1&porPagina=50');
  });

  it('describe el vencimiento y marca las vencidas', () => {
    const ahora = new Date(2030, 0, 10, 12, 0);
    expect(vencimiento(null, ahora)).toBeNull();
    expect(vencimiento(new Date(2030, 0, 10, 9, 0).toISOString(), ahora)).toMatchObject({ vencida: true, hoy: true });
    expect(vencimiento(new Date(2030, 0, 9, 9, 0).toISOString(), ahora)?.texto).toBe('Venció ayer');
    expect(vencimiento(new Date(2030, 0, 11, 9, 0).toISOString(), ahora)?.texto).toMatch(/^Vence mañana/);
  });

  it('separa las menciones del texto', () => {
    expect(partesNota('ok @ana mira, @beto.')).toEqual([
      { t: 'ok ', mencion: false },
      { t: '@ana', mencion: true },
      { t: ' mira, ', mencion: false },
      { t: '@beto', mencion: true },
      { t: '.', mencion: false },
    ]);
  });
});
