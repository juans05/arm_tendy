// Cálculo puro de horarios libres. Todo se guarda en UTC; los horarios semanales están en hora local de la empresa.

export type HorarioSemanal = { dia: number; desde: string; hasta: string };
export type Rango = { inicio: Date; fin: Date };

const MIN = 60_000;

/** Desfase (ms) de la zona respecto a UTC en ese instante. */
function desfase(instante: number, zona: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(instante))
      .map((x) => [x.type, x.value]),
  );
  const local = Date.UTC(
    +p.year,
    +p.month - 1,
    +p.day,
    +p.hour,
    +p.minute,
    +p.second,
  );
  return local - Math.floor(instante / 1000) * 1000;
}

/** "2026-11-09" + "09:00" en la zona de la empresa → instante UTC. */
export function aUtc(fecha: string, hora: string, zona: string): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  const ingenuo = Date.UTC(y, m - 1, d, hh, mm);
  const t = ingenuo - desfase(ingenuo, zona);
  // Segunda pasada por si el cambio de horario de verano cae entre medio.
  return new Date(ingenuo - desfase(t, zona));
}

/** Fecha local "YYYY-MM-DD" y día de la semana (0 = domingo) de un instante en la zona. */
export function diaLocal(instante: Date, zona: string) {
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: zona }).format(
    instante,
  );
  const [y, m, d] = fecha.split('-').map(Number);
  return { fecha, dia: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

const minutos = (h: string) => {
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + mm;
};
const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function huecos(o: {
  zona: string;
  duracionMin: number;
  /** Minutos libres que se exigen antes y después de cada cita u ocupación. */
  margenMin: number;
  /** Anticipación mínima desde "ahora". */
  avisoMin: number;
  pasoMin: number;
  horarios: HorarioSemanal[];
  ocupados: Rango[];
  desde: Date;
  hasta: Date;
  ahora: Date;
}): Date[] {
  const libres: Date[] = [];
  const minimo = o.ahora.getTime() + o.avisoMin * MIN;
  const margen = o.margenMin * MIN;
  // Se recorre día por día (hora local) desde "desde" hasta "hasta".
  for (let t = o.desde.getTime(); t < o.hasta.getTime(); t += 24 * 60 * MIN) {
    const { fecha, dia } = diaLocal(new Date(t), o.zona);
    for (const h of o.horarios.filter((x) => x.dia === dia)) {
      for (
        let m = minutos(h.desde);
        m + o.duracionMin <= minutos(h.hasta);
        m += o.pasoMin
      ) {
        const inicio = aUtc(fecha, hhmm(m), o.zona);
        const fin = inicio.getTime() + o.duracionMin * MIN;
        if (inicio.getTime() < minimo) continue;
        if (inicio < o.desde || fin > o.hasta.getTime()) continue;
        const choca = o.ocupados.some(
          (r) =>
            inicio.getTime() < r.fin.getTime() + margen &&
            fin > r.inicio.getTime() - margen,
        );
        if (!choca && !libres.some((x) => x.getTime() === inicio.getTime()))
          libres.push(inicio);
      }
    }
  }
  return libres.sort((a, b) => a.getTime() - b.getTime());
}
