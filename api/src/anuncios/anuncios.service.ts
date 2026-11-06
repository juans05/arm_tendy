import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { diaLocal } from '../calendario/huecos';
import { MetaGraph } from '../canales/meta-graph.client';
import { CuentaAnuncios } from './cuenta-anuncios.entity';

type Insight = {
  ad_id: string;
  ad_name?: string;
  campaign_name?: string;
  spend?: string;
};
type PaginaInsights = {
  data?: Insight[];
  paging?: { cursors?: { after?: string }; next?: string };
};
type FilaLeads = {
  ad: string;
  leads: number;
  demos: number;
  ventas: number;
  ingresos: string;
};

const dinero = (v: number) => Math.round(v * 100) / 100;
const costo = (gasto: number, n: number) => (n ? dinero(gasto / n) : null);

// Ventas logradas en el período (transición a "ganado" dentro del rango y el lead sigue ganado).
const GANADO = `l.etapa = 'ganado' AND EXISTS (SELECT 1 FROM lead_historial h
  WHERE h.lead_id = l.id AND h.a = 'ganado' AND h.en >= $2 AND h.en < $3)`;

/** Gasto de Meta Ads cruzado con los leads que trajo cada anuncio (referral de WhatsApp). */
@Injectable()
export class AnunciosService {
  constructor(
    private readonly db: DataSource,
    private readonly meta: MetaGraph,
  ) {}

  private repo() {
    return this.db.getRepository(CuentaAnuncios);
  }

  async conectar(tenant: string, cuentaId: string, token: string) {
    const id = cuentaId.trim().replace(/^act_/, '');
    const c = await this.meta
      .llamar<{ name: string; currency: string }>('GET', `/act_${id}`, {
        token,
        query: { fields: 'name,currency' },
      })
      .catch((e: Error) => {
        throw new BadRequestException(
          `Meta no aceptó la cuenta o el token: ${e.message}`,
        );
      });
    await this.repo().save({
      tenant,
      cuentaId: id,
      nombre: c.name,
      moneda: c.currency,
      token,
    });
    return this.cuenta(tenant);
  }

  async cuenta(tenant: string) {
    const c = await this.repo().findOneBy({ tenant });
    return c
      ? { cuentaId: c.cuentaId, nombre: c.nombre, moneda: c.moneda }
      : null;
  }

  async desconectar(tenant: string) {
    await this.repo().delete({ tenant });
  }

  /** null sin cuenta conectada; { error } si Meta falla (el panel sigue funcionando). */
  async resumen(tenant: string, desde: Date, hasta: Date, zona: string) {
    const c = await this.repo().findOneBy({ tenant });
    if (!c) return null;
    let gastos: Insight[];
    try {
      gastos = await this.insights(c, desde, hasta, zona);
    } catch (e) {
      return {
        error: `No se pudo leer el gasto de Meta: ${(e as Error).message}`,
      };
    }
    // Leads del anuncio creados en el período; demos y ventas logradas en el período.
    const filas: FilaLeads[] = await this.db.query(
      `SELECT l.referral->>'sourceId' AS ad,
         count(*) FILTER (WHERE l.created_at >= $2 AND l.created_at < $3)::int AS leads,
         count(*) FILTER (WHERE EXISTS (SELECT 1 FROM lead_historial h WHERE h.lead_id = l.id
           AND h.a = 'demo_agendada' AND h.en >= $2 AND h.en < $3))::int AS demos,
         count(*) FILTER (WHERE ${GANADO})::int AS ventas,
         COALESCE(sum(l.monto) FILTER (WHERE ${GANADO}), 0) AS ingresos
       FROM leads l WHERE l.tenant = $1 AND l.referral->>'sourceId' IS NOT NULL
       GROUP BY 1`,
      [tenant, desde, hasta],
    );
    const porAd = new Map(filas.map((f) => [f.ad, f]));
    const ids = [
      ...new Set([...gastos.map((g) => g.ad_id), ...filas.map((f) => f.ad)]),
    ];
    const porAnuncio = ids
      .map((adId) => {
        const g = gastos.find((x) => x.ad_id === adId);
        const f = porAd.get(adId);
        const gasto = dinero(Number(g?.spend ?? 0));
        const leads = f?.leads ?? 0;
        return {
          adId,
          nombre: g?.ad_name ?? null,
          campana: g?.campaign_name ?? null,
          gasto,
          leads,
          demos: f?.demos ?? 0,
          ventas: f?.ventas ?? 0,
          ingresos: dinero(Number(f?.ingresos ?? 0)),
          costoPorLead: costo(gasto, leads),
        };
      })
      .filter((a) => a.gasto || a.leads || a.demos || a.ventas)
      .sort((a, b) => b.gasto - a.gasto || b.leads - a.leads);
    const suma = (k: 'gasto' | 'leads' | 'demos' | 'ventas' | 'ingresos') =>
      dinero(porAnuncio.reduce((t, a) => t + a[k], 0));
    const gasto = suma('gasto');
    const ingresos = suma('ingresos');
    return {
      cuenta: c.nombre,
      moneda: c.moneda,
      gasto,
      leads: suma('leads'),
      demos: suma('demos'),
      ventas: suma('ventas'),
      ingresos,
      costoPorLead: costo(gasto, suma('leads')),
      costoPorDemo: costo(gasto, suma('demos')),
      costoPorVenta: costo(gasto, suma('ventas')),
      retorno: gasto ? dinero(ingresos / gasto) : null,
      porAnuncio,
    };
  }

  private async insights(
    c: CuentaAnuncios,
    desde: Date,
    hasta: Date,
    zona: string,
  ): Promise<Insight[]> {
    const ultimo = new Date(Math.max(desde.getTime(), hasta.getTime() - 1));
    const rango = JSON.stringify({
      since: diaLocal(desde, zona).fecha,
      until: diaLocal(ultimo, zona).fecha,
    });
    const todos: Insight[] = [];
    let after: string | undefined;
    // ponytail: hasta 10 páginas de 500 anuncios; más que eso pediría un reporte asíncrono de Meta.
    for (let i = 0; i < 10; i++) {
      const p = await this.meta.llamar<PaginaInsights>(
        'GET',
        `/act_${c.cuentaId}/insights`,
        {
          token: c.token,
          query: {
            level: 'ad',
            fields: 'ad_id,ad_name,campaign_name,spend',
            time_range: rango,
            limit: '500',
            ...(after ? { after } : {}),
          },
        },
      );
      todos.push(...(p.data ?? []));
      after = p.paging?.next ? p.paging.cursors?.after : undefined;
      if (!after) break;
    }
    return todos;
  }
}
