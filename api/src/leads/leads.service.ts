import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, FindOptionsWhere, IsNull } from 'typeorm';
import { Tarea } from '../actividad/tarea.entity';
import { AlertasService } from '../alertas/alertas.service';
import { Contacto } from '../bandeja/contacto.entity';
import { Conversacion } from '../bandeja/conversacion.entity';
import { EventosService } from '../bandeja/eventos.service';
import { LineaProducto } from '../lineas/linea-producto.entity';
import { Miembro } from '../miembros/miembro.entity';
import { LeadHistorial } from './lead-historial.entity';
import { Etapa, Lead } from './lead.entity';

export const ETAPAS_CERRADAS: Etapa[] = [
  'ganado',
  'perdido',
  'archivado',
  'descartado',
];

const MOTIVOS_TRASPASO: Record<string, string> = {
  pide_humano: 'pidió hablar con una persona',
  molesto: 'parece molesto',
  demo: 'agendó una demo',
};

export type FiltroLeads = { etapa?: Etapa; lineaId?: string; duenoId?: string };

export const ORDENES = [
  'reciente',
  'antiguo',
  'puntaje',
  'monto',
  'nombre',
] as const;
/** Filtros de la tabla de leads; también es lo que guarda una vista. duenoId 'sin': sin dueño. */
export type FiltroTabla = {
  q?: string;
  etapas?: Etapa[];
  lineaId?: string;
  duenoId?: string;
  calificado?: boolean;
  orden?: (typeof ORDENES)[number];
  pagina?: number;
  porPagina?: number;
};

const ORDEN_SQL: Record<(typeof ORDENES)[number], [string, 'ASC' | 'DESC']> = {
  reciente: ['l.etapaEn', 'DESC'],
  antiguo: ['l.etapaEn', 'ASC'],
  puntaje: ['l.puntaje', 'DESC'],
  monto: ['l.monto', 'DESC'],
  nombre: ['c.nombre', 'ASC'],
};

const DIA = 86_400_000;
/** Automatizaciones: al entrar a estas etapas, el dueño recibe su próxima tarea. */
const TAREA_AL_ENTRAR: Partial<Record<Etapa, [string, number]>> = {
  no_asistio: ['Reagendar la demo', 1],
  demo_realizada: ['Enviar la propuesta y cerrar', 2],
  ganado: ['Dar de alta al cliente en ARP', 1],
};
export type CambioLead = {
  etapa?: Etapa;
  duenoId?: string | null;
  monto?: number | null;
  plan?: string | null;
  motivo?: string | null;
  lineaId?: string | null;
};

/** Toda transición de etapa queda en lead_historial: de ahí salen las tasas y tiempos del panel. */
export async function anotarEtapa(
  em: EntityManager,
  lead: Pick<Lead, 'id' | 'tenant' | 'etapa'>,
  a: Etapa,
  miembroId: string | null,
): Promise<boolean> {
  if (lead.etapa === a) return false;
  // Solo si la etapa sigue siendo la que se leyó: no pisa un cambio que alguien hizo entretanto.
  // Cada entrada a "seguimiento" empieza su calendario de cero.
  const r = await em.update(
    Lead,
    { id: lead.id, etapa: lead.etapa },
    {
      etapa: a,
      etapaEn: new Date(),
      seguimientoProximo: null,
      seguimientoPaso: 0,
    },
  );
  if (!r.affected) return false;
  await em.insert(LeadHistorial, {
    tenant: lead.tenant,
    leadId: lead.id,
    de: lead.etapa,
    a,
    miembroId,
  });
  // Un lead cerrado ya no necesita las tareas que crearon las automatizaciones.
  if (ETAPAS_CERRADAS.includes(a))
    await em.update(
      Tarea,
      { leadId: lead.id, origen: 'auto', estado: 'pendiente' },
      { estado: 'cancelada' },
    );
  const tarea = TAREA_AL_ENTRAR[a];
  if (tarea) {
    const { duenoId } = await em.findOneByOrFail(Lead, { id: lead.id });
    if (duenoId)
      await em.insert(Tarea, {
        tenant: lead.tenant,
        leadId: lead.id,
        titulo: tarea[0],
        venceEn: new Date(Date.now() + tarea[1] * DIA),
        responsableId: duenoId,
        creadorId: null,
        origen: 'auto',
      });
  }
  return true;
}

@Injectable()
export class LeadsService {
  constructor(
    private readonly db: DataSource,
    private readonly eventos: EventosService,
    private readonly alertas: AlertasService,
  ) {}

  /** Un comercial ve sus leads y los que aún no tienen dueño; el gerente ve todos. */
  private visibles(m: Miembro, base: FindOptionsWhere<Lead>) {
    return m.rol === 'gerente'
      ? [base]
      : [
          { ...base, duenoId: m.id },
          { ...base, duenoId: IsNull() },
        ];
  }

  // ponytail: tope de 500 leads por consulta; paginar cuando un embudo los supere.
  listar(m: Miembro, f: FiltroLeads): Promise<Lead[]> {
    const base: FindOptionsWhere<Lead> = { tenant: m.tenant };
    if (f.etapa) base.etapa = f.etapa;
    if (f.lineaId) base.lineaId = f.lineaId;
    if (f.duenoId) base.duenoId = f.duenoId;
    return this.db.getRepository(Lead).find({
      where: this.visibles(m, base),
      relations: { contacto: true },
      order: { etapaEn: 'DESC' },
      take: 500,
    });
  }

  /** Tabla de leads: búsqueda por nombre, teléfono o dato extraído, filtros, orden y páginas. */
  async tabla(
    m: Miembro,
    f: FiltroTabla,
  ): Promise<{ items: Lead[]; total: number }> {
    const qb = this.db
      .getRepository(Lead)
      .createQueryBuilder('l')
      .innerJoinAndSelect('l.contacto', 'c')
      .where('l.tenant = :tenant', { tenant: m.tenant });
    if (m.rol !== 'gerente')
      qb.andWhere('(l.dueno_id = :yo OR l.dueno_id IS NULL)', { yo: m.id });
    const q = f.q?.trim();
    if (q) {
      const patron = `%${q.replace(/[\\%_]/g, (x) => '\\' + x)}%`;
      qb.andWhere(
        `(c.nombre ILIKE :p OR c.telefono LIKE :p OR l.plan ILIKE :p
          OR EXISTS (SELECT 1 FROM jsonb_each(l.datos) d WHERE d.value->>'valor' ILIKE :p))`,
        { p: patron },
      );
    }
    if (f.etapas?.length)
      qb.andWhere('l.etapa IN (:...etapas)', { etapas: f.etapas });
    if (f.lineaId) qb.andWhere('l.linea_id = :linea', { linea: f.lineaId });
    if (f.duenoId === 'sin') qb.andWhere('l.dueno_id IS NULL');
    else if (f.duenoId)
      qb.andWhere('l.dueno_id = :dueno', { dueno: f.duenoId });
    if (f.calificado !== undefined)
      qb.andWhere('l.calificado = :cal', { cal: f.calificado });
    const [col, dir] = ORDEN_SQL[f.orden ?? 'reciente'];
    const porPagina = Math.min(f.porPagina ?? 50, 100);
    const [items, total] = await qb
      .orderBy(col, dir, 'NULLS LAST')
      .addOrderBy('l.id')
      .skip(((f.pagina ?? 1) - 1) * porPagina)
      .take(porPagina)
      .getManyAndCount();
    return { items, total };
  }

  async uno(m: Miembro, id: string): Promise<Lead> {
    const lead = await this.db
      .getRepository(Lead)
      .findOne({ where: this.visibles(m, { tenant: m.tenant, id }) });
    if (!lead) throw new NotFoundException('Lead no encontrado');
    return lead;
  }

  async conContacto(m: Miembro, id: string): Promise<Lead> {
    await this.uno(m, id);
    return this.db
      .getRepository(Lead)
      .findOneOrFail({ where: { id }, relations: { contacto: true } });
  }

  async historial(m: Miembro, id: string): Promise<LeadHistorial[]> {
    await this.uno(m, id);
    return this.db
      .getRepository(LeadHistorial)
      .find({ where: { leadId: id }, order: { en: 'ASC' } });
  }

  async actualizar(m: Miembro, id: string, c: CambioLead): Promise<Lead> {
    const lead = await this.uno(m, id);
    const cambios: Partial<Lead> = {};

    if (c.duenoId !== undefined && c.duenoId !== lead.duenoId) {
      const seLoToma = c.duenoId === m.id && lead.duenoId === null;
      if (m.rol !== 'gerente' && !seLoToma)
        throw new ForbiddenException('Solo un gerente reasigna leads');
      if (
        c.duenoId &&
        !(await this.db.getRepository(Miembro).exists({
          where: { id: c.duenoId, tenant: m.tenant, estado: 'activo' },
        }))
      )
        throw new BadRequestException('El dueño debe ser un miembro activo');
      cambios.duenoId = c.duenoId;
    }
    if (c.lineaId !== undefined) {
      if (
        c.lineaId &&
        !(await this.db
          .getRepository(LineaProducto)
          .exists({ where: { id: c.lineaId, tenant: m.tenant } }))
      )
        throw new BadRequestException('Línea no encontrada');
      cambios.lineaId = c.lineaId;
    }
    if (c.monto !== undefined) cambios.monto = c.monto;
    if (c.plan !== undefined) cambios.plan = c.plan;
    if (c.motivo !== undefined) cambios.motivo = c.motivo;

    const etapa = c.etapa ?? lead.etapa;
    if (c.etapa && c.etapa !== lead.etapa) {
      if (etapa === 'ganado' && !(c.monto ?? lead.monto ?? 0))
        throw new BadRequestException('Para marcar ganado indica el monto');
      if (
        (etapa === 'perdido' || etapa === 'descartado') &&
        !(c.motivo ?? lead.motivo)?.trim()
      )
        throw new BadRequestException('Indica el motivo');
    }

    // Un comercial que se lo toma solo gana si sigue sin dueño (otro pudo tomarlo entretanto).
    const seLoTomaSinDueno = 'duenoId' in cambios && m.rol !== 'gerente';
    await this.db.transaction(async (em) => {
      if (Object.keys(cambios).length) {
        const r = await em.update(
          Lead,
          seLoTomaSinDueno
            ? { id: lead.id, duenoId: IsNull() }
            : { id: lead.id },
          cambios,
        );
        if (!r.affected)
          throw new ConflictException('Otro comercial ya tomó este lead');
      }
      if (c.etapa) await anotarEtapa(em, lead, c.etapa, m.id);
    });
    return this.emitir(lead.id, lead.conversacionId, m.tenant);
  }

  /** Gancho del agente: la conversación pasó a una persona. Asigna dueño si no tiene y avisa. */
  async asignarAlTraspaso(conv: Conversacion, motivo: string): Promise<void> {
    const lead = await this.db
      .getRepository(Lead)
      .findOneBy({ conversacionId: conv.id });
    if (!lead) return;
    const cambios: Partial<Lead> = {};
    if (!lead.traspasoEn) {
      cambios.traspasoEn = new Date();
      cambios.traspasoMotivo = motivo.slice(0, 20);
    }
    let duenoId = lead.duenoId;
    if (!duenoId) {
      duenoId = await this.elegirComercial(lead);
      if (duenoId) cambios.duenoId = duenoId;
    }
    if (Object.keys(cambios).length)
      await this.db.getRepository(Lead).update(lead.id, cambios);
    await this.emitir(lead.id, conv.id, conv.tenant);

    const contacto =
      conv.contacto ??
      (await this.db
        .getRepository(Contacto)
        .findOneBy({ id: conv.contactoId }));
    await this.alertas.avisar(
      conv.tenant,
      duenoId ? [duenoId] : await this.alertas.gerentes(conv.tenant),
      {
        tipo: 'lead_asignado',
        titulo: `${contacto?.nombre ?? 'Un cliente'} te espera en el chat`,
        detalle: `${MOTIVOS_TRASPASO[motivo] ?? motivo}${duenoId ? '' : ' (sin comercial disponible: asígnalo)'}`,
        enlace: `/bandeja?c=${conv.id}`,
      },
    );
  }

  async elegirComercial(lead: Lead): Promise<string | null> {
    return (await this.candidatos(lead))[0] ?? null;
  }

  /** Comerciales de la línea (o los que reciben demos), del que tiene menos leads abiertos al que más. */
  async candidatos(lead: Lead): Promise<string[]> {
    let candidatos: string[] = [];
    if (lead.lineaId) {
      const linea = await this.db.getRepository(LineaProducto).findOne({
        where: { id: lead.lineaId },
        relations: { comerciales: true },
      });
      candidatos = (linea?.comerciales ?? [])
        .filter((c) => c.estado === 'activo')
        .map((c) => c.id);
    }
    if (!candidatos.length)
      candidatos = (
        await this.db.getRepository(Miembro).findBy({
          tenant: lead.tenant,
          estado: 'activo',
          recibeDemos: true,
        })
      ).map((m) => m.id);
    if (!candidatos.length) return [];
    const carga: { dueno_id: string; n: string }[] = await this.db.query(
      `SELECT dueno_id, count(*) AS n FROM leads
        WHERE dueno_id = ANY($1) AND etapa <> ALL($2) GROUP BY dueno_id`,
      [candidatos, ETAPAS_CERRADAS],
    );
    const n = (id: string) =>
      Number(carga.find((c) => c.dueno_id === id)?.n ?? 0);
    return candidatos.sort((a, b) => n(a) - n(b));
  }

  async emitir(id: string, conversacionId: string, tenant: string) {
    const lead = await this.db.getRepository(Lead).findOneByOrFail({ id });
    this.eventos.emitir(tenant, { tipo: 'lead', conversacionId, lead });
    return lead;
  }
}
