import { ForbiddenException, Injectable, Optional } from '@nestjs/common';
import { AnunciosService } from '../anuncios/anuncios.service';
import { DataSource } from 'typeorm';
import * as XLSX from 'xlsx';
import {
  configPorDefecto,
  EmpresaConfig,
} from '../agente/empresa-config.entity';
import { Horario } from '../calendario/horario.entity';
import { aUtc, diaLocal } from '../calendario/huecos';
import { Miembro } from '../miembros/miembro.entity';

export type FiltroKpis = {
  desde: Date;
  hasta: Date;
  lineaId?: string;
  duenoId?: string;
  /** anuncio: llegó por un anuncio de Meta (referral); organico: el resto. */
  origen?: 'anuncio' | 'organico';
};

const n = (v: unknown) => Number(v ?? 0);
const horas = (v: unknown) =>
  v === null || v === undefined ? null : Math.round(n(v) * 10) / 10;
const tasa = (a: number, b: number) =>
  b ? Math.round((a / b) * 1000) / 10 : null;

// Filtro común sobre leads "l": $1 empresa, $4 línea, $5 comercial, $6 origen.
const FILTRO = `l.tenant = $1 AND ($4::uuid IS NULL OR l.linea_id = $4) AND ($5::uuid IS NULL OR l.dueno_id = $5)
  AND ($6::text IS NULL OR ($6 = 'anuncio') = (l.referral IS NOT NULL))`;

@Injectable()
export class ReportesService {
  constructor(
    private readonly db: DataSource,
    @Optional() private readonly anuncios?: AnunciosService,
  ) {}

  private exigirGerente(m: Miembro) {
    if (m.rol !== 'gerente')
      throw new ForbiddenException('Solo el gerente ve el panel');
  }

  async kpis(m: Miembro, f: FiltroKpis) {
    this.exigirGerente(m);
    const largo = f.hasta.getTime() - f.desde.getTime();
    const zona = (await this.config(m.tenant)).zonaHoraria;
    const [actual, anterior, proximo, anuncios] = await Promise.all([
      this.calcular(m.tenant, f),
      this.calcular(m.tenant, {
        ...f,
        desde: new Date(f.desde.getTime() - largo),
        hasta: f.desde,
      }),
      this.proximo(m.tenant),
      // Gasto de Meta Ads del período (sin filtros de línea o comercial: Meta no los conoce).
      this.anuncios?.resumen(m.tenant, f.desde, f.hasta, zona) ?? null,
    ]);
    return { actual, anterior, proximo, anuncios };
  }

  private q<T = Record<string, unknown>>(
    sql: string,
    tenant: string,
    f: FiltroKpis,
  ): Promise<T[]> {
    return this.db.query(sql, [
      tenant,
      f.desde,
      f.hasta,
      f.lineaId ?? null,
      f.duenoId ?? null,
      f.origen ?? null,
    ]);
  }

  async calcular(tenant: string, f: FiltroKpis) {
    // Transiciones de etapa dentro del período (para ventas y motivos).
    const enPeriodo = (etapa: string) =>
      `SELECT DISTINCT ON (h.lead_id) h.lead_id, h.en FROM lead_historial h JOIN leads l ON l.id = h.lead_id
        WHERE ${FILTRO} AND h.a = '${etapa}' AND h.en >= $2 AND h.en < $3 AND l.etapa = '${etapa}'
        ORDER BY h.lead_id, h.en`;

    const [
      ventas,
      porLinea,
      embudo,
      tiempos,
      perdida,
      descarte,
      asistencia,
      porComercial,
      ia,
      preguntas,
      traspasos,
      seguimiento,
      anuncios,
      horasLeads,
    ] = await Promise.all([
      this.q(
        `SELECT count(*) AS cantidad, COALESCE(sum(l.monto), 0) AS monto
             FROM (${enPeriodo('ganado')}) g JOIN leads l ON l.id = g.lead_id`,
        tenant,
        f,
      ),
      this.q(
        `SELECT COALESCE(li.nombre, 'Sin línea') AS linea, count(*) AS cantidad, COALESCE(sum(l.monto), 0) AS monto
             FROM (${enPeriodo('ganado')}) g JOIN leads l ON l.id = g.lead_id LEFT JOIN lineas_producto li ON li.id = l.linea_id
            GROUP BY 1 ORDER BY 3 DESC`,
        tenant,
        f,
      ),
      // Embudo por cohorte: leads que llegaron en el período y hasta dónde avanzaron.
      this.q(
        `SELECT count(*) AS leads,
                  count(*) FILTER (WHERE l.calificado) AS calificados,
                  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM lead_historial h WHERE h.lead_id = l.id AND h.a = 'demo_agendada')) AS demo_agendada,
                  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM lead_historial h WHERE h.lead_id = l.id AND h.a = 'demo_realizada')) AS demo_realizada,
                  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM lead_historial h WHERE h.lead_id = l.id AND h.a = 'ganado')) AS ganado
             FROM leads l WHERE ${FILTRO} AND l.created_at >= $2 AND l.created_at < $3`,
        tenant,
        f,
      ),
      this.q(
        `WITH e AS (
             SELECT l.id, l.created_at,
                    (SELECT min(en) FROM lead_historial h WHERE h.lead_id = l.id AND h.a = 'demo_agendada') AS agendada,
                    (SELECT min(en) FROM lead_historial h WHERE h.lead_id = l.id AND h.a = 'demo_realizada') AS realizada,
                    (SELECT min(en) FROM lead_historial h WHERE h.lead_id = l.id AND h.a = 'ganado') AS ganado
               FROM leads l WHERE ${FILTRO} AND l.created_at >= $2 AND l.created_at < $3)
           SELECT avg(extract(epoch FROM agendada - created_at)) / 3600 AS a_demo,
                  avg(extract(epoch FROM realizada - agendada)) / 3600 AS a_realizada,
                  avg(extract(epoch FROM ganado - realizada)) / 3600 AS a_ganado,
                  avg(extract(epoch FROM ganado - created_at)) / 3600 AS ciclo
             FROM e`,
        tenant,
        f,
      ),
      this.q(
        `SELECT COALESCE(NULLIF(l.motivo, ''), 'sin motivo') AS motivo, count(*) AS n
             FROM (${enPeriodo('perdido')}) p JOIN leads l ON l.id = p.lead_id GROUP BY 1 ORDER BY 2 DESC, 1`,
        tenant,
        f,
      ),
      this.q(
        `SELECT COALESCE(NULLIF(l.motivo, ''), 'sin motivo') AS motivo, count(*) AS n
             FROM (${enPeriodo('descartado')}) p JOIN leads l ON l.id = p.lead_id GROUP BY 1 ORDER BY 2 DESC, 1`,
        tenant,
        f,
      ),
      this.q(
        `SELECT count(*) FILTER (WHERE c.estado = 'realizada') AS realizadas,
                  count(*) FILTER (WHERE c.estado = 'no_asistio') AS no_asistio,
                  count(*) FILTER (WHERE c.estado <> 'cancelada') AS agendadas
             FROM citas c LEFT JOIN leads l ON l.id = c.lead_id
            WHERE c.tenant = $1 AND c.inicio >= $2 AND c.inicio < $3 AND c.inicio < now()
              AND (c.lead_id IS NULL OR (${FILTRO}))`,
        tenant,
        f,
      ),
      this.q(
        `SELECT mi.id, mi.nombre, mi.rol,
                  (SELECT count(*) FROM citas c LEFT JOIN leads l ON l.id = c.lead_id WHERE c.miembro_id = mi.id AND c.estado = 'realizada'
                     AND c.inicio >= $2 AND c.inicio < $3 AND (c.lead_id IS NULL OR (${FILTRO}))) AS demos,
                  (SELECT count(*) FROM citas c LEFT JOIN leads l ON l.id = c.lead_id WHERE c.miembro_id = mi.id AND c.estado = 'no_asistio'
                     AND c.inicio >= $2 AND c.inicio < $3 AND (c.lead_id IS NULL OR (${FILTRO}))) AS no_asistio,
                  (SELECT count(*) FROM (${enPeriodo('ganado')}) g JOIN leads l ON l.id = g.lead_id WHERE l.dueno_id = mi.id) AS ganados,
                  (SELECT COALESCE(sum(l.monto), 0) FROM (${enPeriodo('ganado')}) g JOIN leads l ON l.id = g.lead_id WHERE l.dueno_id = mi.id) AS monto,
                  (SELECT avg(extract(epoch FROM (SELECT min(m.created_at) FROM mensajes m WHERE m.conversacion_id = l.conversacion_id
                            AND m.origen = 'humano' AND m.created_at >= l.traspaso_en) - l.traspaso_en)) / 60
                     FROM leads l WHERE ${FILTRO} AND l.dueno_id = mi.id AND l.traspaso_en >= $2 AND l.traspaso_en < $3) AS primera_respuesta,
                  (SELECT count(*) FROM conversaciones c JOIN leads l ON l.conversacion_id = c.id
                    WHERE l.dueno_id = mi.id AND c.modo = 'humano' AND c.alerta_nivel > 0) AS sin_atender
             FROM miembros mi WHERE mi.tenant = $1 AND mi.estado = 'activo' ORDER BY mi.nombre`,
        tenant,
        f,
      ),
      this.q(
        `SELECT avg(extract(epoch FROM r.ia - r.cliente)) AS primera_respuesta,
                  count(*) FILTER (WHERE r.calificado AND r.humano IS NULL) AS calificados_sin_humano,
                  count(*) FILTER (WHERE r.calificado) AS calificados,
                  count(*) FILTER (WHERE r.motivo = 'pidió no ser contactado') AS bajas
             FROM (SELECT l.calificado, l.motivo,
                          (SELECT min(created_at) FROM mensajes m WHERE m.conversacion_id = l.conversacion_id AND m.origen = 'cliente') AS cliente,
                          (SELECT min(created_at) FROM mensajes m WHERE m.conversacion_id = l.conversacion_id AND m.origen = 'ia') AS ia,
                          (SELECT min(created_at) FROM mensajes m WHERE m.conversacion_id = l.conversacion_id AND m.origen IN ('humano', 'app_celular')) AS humano
                     FROM leads l WHERE ${FILTRO} AND l.created_at >= $2 AND l.created_at < $3) r`,
        tenant,
        f,
      ),
      this.q(
        `SELECT p.pregunta, count(*) AS n FROM preguntas p
            WHERE p.tenant = $1 AND p.created_at >= $2 AND p.created_at < $3 AND $4::uuid IS NULL AND $5::uuid IS NULL AND $6::text IS NULL
            GROUP BY 1 ORDER BY 2 DESC LIMIT 5`,
        tenant,
        f,
      ),
      this.q(
        `SELECT l.traspaso_motivo AS motivo, count(*) AS n FROM leads l
            WHERE ${FILTRO} AND l.traspaso_en >= $2 AND l.traspaso_en < $3 GROUP BY 1 ORDER BY 2 DESC`,
        tenant,
        f,
      ),
      this.q(
        `SELECT count(DISTINCT h.lead_id) AS entraron,
                  count(DISTINCT h.lead_id) FILTER (WHERE EXISTS (SELECT 1 FROM lead_historial x WHERE x.lead_id = h.lead_id AND x.de = 'seguimiento' AND x.a = 'en_conversacion' AND x.en > h.en)) AS volvieron,
                  count(DISTINCT h.lead_id) FILTER (WHERE EXISTS (SELECT 1 FROM lead_historial x WHERE x.lead_id = h.lead_id AND x.a = 'demo_agendada' AND x.en > h.en)) AS a_demo
             FROM lead_historial h JOIN leads l ON l.id = h.lead_id
            WHERE ${FILTRO} AND h.a = 'seguimiento' AND h.en >= $2 AND h.en < $3`,
        tenant,
        f,
      ),
      this.q(
        `SELECT COALESCE(l.referral->>'headline', l.referral->>'sourceUrl', 'Anuncio') AS anuncio, l.referral->>'sourceId' AS id,
                  count(*) AS leads,
                  count(*) FILTER (WHERE EXISTS (SELECT 1 FROM lead_historial h WHERE h.lead_id = l.id AND h.a = 'demo_agendada')) AS demos,
                  count(*) FILTER (WHERE l.etapa = 'ganado') AS ganados,
                  COALESCE(sum(l.monto) FILTER (WHERE l.etapa = 'ganado'), 0) AS monto
             FROM leads l WHERE ${FILTRO} AND l.referral IS NOT NULL AND l.created_at >= $2 AND l.created_at < $3
            GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 20`,
        tenant,
        f,
      ),
      // ponytail: tope de 5000 leads para el reparto por hora; agregarlo en SQL si una empresa lo supera.
      this.q<{ created_at: Date }>(
        `SELECT l.created_at FROM leads l WHERE ${FILTRO} AND l.created_at >= $2 AND l.created_at < $3 LIMIT 5000`,
        tenant,
        f,
      ),
    ]);

    const v = ventas[0];
    const e = embudo[0];
    const t = tiempos[0];
    const a = asistencia[0];
    const i = ia[0];
    const s = seguimiento[0];
    return {
      ventas: {
        cantidad: n(v.cantidad),
        monto: n(v.monto),
        ticket: n(v.cantidad)
          ? Math.round((n(v.monto) / n(v.cantidad)) * 100) / 100
          : 0,
        porLinea: porLinea.map((r) => ({
          linea: r.linea as string,
          cantidad: n(r.cantidad),
          monto: n(r.monto),
        })),
      },
      embudo: {
        leads: n(e.leads),
        calificados: n(e.calificados),
        demoAgendada: n(e.demo_agendada),
        demoRealizada: n(e.demo_realizada),
        ganado: n(e.ganado),
      },
      tiempos: {
        aDemoHoras: horas(t.a_demo),
        aRealizadaHoras: horas(t.a_realizada),
        aGanadoHoras: horas(t.a_ganado),
        cicloHoras: horas(t.ciclo),
      },
      motivosPerdida: perdida.map((r) => ({
        motivo: r.motivo as string,
        n: n(r.n),
      })),
      motivosDescarte: descarte.map((r) => ({
        motivo: r.motivo as string,
        n: n(r.n),
      })),
      asistencia: {
        agendadas: n(a.agendadas),
        realizadas: n(a.realizadas),
        noAsistio: n(a.no_asistio),
        tasa: tasa(n(a.realizadas), n(a.realizadas) + n(a.no_asistio)),
      },
      porComercial: porComercial
        .map((r) => ({
          id: r.id as string,
          nombre: r.nombre as string,
          rol: r.rol as string,
          demosRealizadas: n(r.demos),
          noAsistio: n(r.no_asistio),
          ganados: n(r.ganados),
          monto: n(r.monto),
          tasaCierre: tasa(n(r.ganados), n(r.demos)),
          primeraRespuestaMin: horas(r.primera_respuesta),
          sinAtender: n(r.sin_atender),
        }))
        .filter(
          (r) =>
            r.rol !== 'gerente' ||
            r.demosRealizadas ||
            r.ganados ||
            r.sinAtender,
        ),
      ia: {
        primeraRespuestaSeg: horas(i.primera_respuesta),
        calificadosSinHumano: tasa(
          n(i.calificados_sin_humano),
          n(i.calificados),
        ),
        bajas: n(i.bajas),
        preguntasTop: preguntas.map((r) => ({
          pregunta: r.pregunta as string,
          n: n(r.n),
        })),
        traspasos: traspasos.map((r) => ({
          motivo: r.motivo as string,
          n: n(r.n),
        })),
      },
      seguimiento: {
        entraron: n(s.entraron),
        volvieron: tasa(n(s.volvieron), n(s.entraron)),
        llegaronADemo: tasa(n(s.a_demo), n(s.entraron)),
      },
      anuncios: anuncios.map((r) => ({
        anuncio: r.anuncio as string,
        id: (r.id as string) ?? null,
        leads: n(r.leads),
        demos: n(r.demos),
        ganados: n(r.ganados),
        monto: n(r.monto),
      })),
      cuando: await this.cuando(
        tenant,
        horasLeads.map((r) => new Date(r.created_at)),
      ),
    };
  }

  private async config(tenant: string) {
    return (
      (await this.db.getRepository(EmpresaConfig).findOneBy({ tenant })) ??
      configPorDefecto(tenant)
    );
  }

  /** Leads por día de la semana y hora (hora local), y % que llegó fuera del horario de los comerciales. */
  private async cuando(tenant: string, fechas: Date[]) {
    const config = await this.config(tenant);
    const horarios = await this.db
      .createQueryBuilder(Horario, 'h')
      .innerJoin(Miembro, 'm', "m.id = h.miembro_id AND m.estado = 'activo'")
      .where('h.tenant = :tenant', { tenant })
      .getMany();
    const porDia = Array<number>(7).fill(0);
    const porHora = Array<number>(24).fill(0);
    let fuera = 0;
    for (const d of fechas) {
      const { fecha, dia } = diaLocal(d, config.zonaHoraria);
      const hora = Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: config.zonaHoraria,
          hour: '2-digit',
          hourCycle: 'h23',
        }).format(d),
      );
      porDia[dia]++;
      porHora[hora]++;
      const cubierto = horarios.some(
        (h) =>
          h.dia === dia &&
          d >= aUtc(fecha, h.desde.slice(0, 5), config.zonaHoraria) &&
          d < aUtc(fecha, h.hasta.slice(0, 5), config.zonaHoraria),
      );
      if (horarios.length && !cubierto) fuera++;
    }
    return {
      porDia,
      porHora,
      fueraDeHorario: horarios.length ? tasa(fuera, fechas.length) : null,
    };
  }

  async proximo(tenant: string) {
    const [r] = await this.db.query(
      `SELECT (SELECT count(*) FROM citas WHERE tenant = $1 AND estado = 'agendada' AND inicio >= now() AND inicio < now() + interval '7 days') AS demos,
              (SELECT count(*) FROM leads WHERE tenant = $1 AND etapa = 'seguimiento') AS seguimiento`,
      [tenant],
    );
    return { demos: n(r.demos), seguimientoActivos: n(r.seguimiento) };
  }

  async excel(m: Miembro, f: FiltroKpis): Promise<Buffer> {
    this.exigirGerente(m);
    const filas: Record<string, unknown>[] = await this.q(
      `SELECT ct.nombre AS "Cliente", ct.telefono AS "Teléfono", l.etapa AS "Etapa", li.nombre AS "Línea",
              mi.nombre AS "Comercial", l.monto AS "Monto", l.plan AS "Plan", l.motivo AS "Motivo", l.puntaje AS "Puntaje",
              CASE WHEN l.referral IS NULL THEN 'Orgánico' ELSE COALESCE(l.referral->>'headline', 'Anuncio') END AS "Origen",
              l.created_at AS "Llegó"
         FROM leads l JOIN contactos ct ON ct.id = l.contacto_id
         LEFT JOIN lineas_producto li ON li.id = l.linea_id LEFT JOIN miembros mi ON mi.id = l.dueno_id
        WHERE ${FILTRO} AND l.created_at >= $2 AND l.created_at < $3
        ORDER BY l.created_at`,
      m.tenant,
      f,
    );
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      libro,
      XLSX.utils.json_to_sheet(
        filas.map((r) => ({
          ...r,
          Monto: r.Monto === null ? null : Number(r.Monto),
        })),
      ),
      'Leads',
    );
    return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
