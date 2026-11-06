import { aUtc, huecos } from './huecos';

const Z = 'America/Lima'; // UTC-5, sin horario de verano
const iso = (d: Date[]) => d.map((x) => x.toISOString());
// Lunes 2026-11-09 en Lima. Horario de lunes 09:00–11:00.
const base = {
  zona: Z,
  duracionMin: 30,
  margenMin: 0,
  avisoMin: 0,
  pasoMin: 30,
  horarios: [{ dia: 1, desde: '09:00:00', hasta: '11:00:00' }],
  ocupados: [],
  desde: new Date('2026-11-09T00:00:00-05:00'),
  hasta: new Date('2026-11-10T00:00:00-05:00'),
  ahora: new Date('2026-11-08T12:00:00-05:00'),
};

describe('huecos', () => {
  it('aUtc convierte hora local de la empresa a UTC', () => {
    expect(aUtc('2026-11-09', '09:00', Z).toISOString()).toBe(
      '2026-11-09T14:00:00.000Z',
    );
  });

  it('parte el horario en turnos de la duración de la demo', () => {
    expect(iso(huecos(base))).toEqual([
      '2026-11-09T14:00:00.000Z',
      '2026-11-09T14:30:00.000Z',
      '2026-11-09T15:00:00.000Z',
      '2026-11-09T15:30:00.000Z',
    ]);
  });

  it('un día sin horario no ofrece nada', () => {
    expect(
      huecos({
        ...base,
        desde: new Date('2026-11-10T00:00:00-05:00'),
        hasta: new Date('2026-11-11T00:00:00-05:00'),
      }),
    ).toEqual([]);
  });

  it('salta citas y bloqueos respetando el margen entre citas', () => {
    const r = huecos({
      ...base,
      margenMin: 10,
      ocupados: [
        {
          inicio: new Date('2026-11-09T09:30:00-05:00'),
          fin: new Date('2026-11-09T10:00:00-05:00'),
        },
      ],
    });
    // 09:00 termina 09:30 pero el margen pide hasta 09:20; 10:00 empieza antes de 10:10.
    expect(iso(r)).toEqual(['2026-11-09T15:30:00.000Z']);
  });

  it('respeta la anticipación mínima', () => {
    const r = huecos({
      ...base,
      ahora: new Date('2026-11-09T08:00:00-05:00'),
      avisoMin: 120,
    });
    expect(iso(r)).toEqual([
      '2026-11-09T15:00:00.000Z',
      '2026-11-09T15:30:00.000Z',
    ]);
  });

  it('una demo más larga que el turno no entra', () => {
    expect(huecos({ ...base, duracionMin: 150 })).toEqual([]);
  });

  it('con horario de verano no se salta el día del cambio', () => {
    // Nueva York adelanta la hora el domingo 2026-03-08 (ese día dura 23 h).
    const r = huecos({
      ...base,
      zona: 'America/New_York',
      duracionMin: 60,
      pasoMin: 60,
      horarios: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({
        dia,
        desde: '09:00:00',
        hasta: '10:00:00',
      })),
      desde: new Date('2026-03-08T04:30:00Z'), // sábado 7, 23:30 en Nueva York
      hasta: new Date('2026-03-10T04:30:00Z'),
      ahora: new Date('2026-03-01T00:00:00Z'),
    });
    expect(iso(r)).toEqual([
      '2026-03-08T13:00:00.000Z',
      '2026-03-09T13:00:00.000Z',
    ]);
  });
});
