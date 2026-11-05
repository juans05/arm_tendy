import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { DataSource, LessThan, MoreThan } from 'typeorm';
import {
  configPorDefecto,
  EmpresaConfig,
} from '../agente/empresa-config.entity';
import { AlertasService } from '../alertas/alertas.service';
import { Contacto } from '../bandeja/contacto.entity';
import { Conversacion } from '../bandeja/conversacion.entity';
import { Etapa, Lead } from '../leads/lead.entity';
import { anotarEtapa, LeadsService } from '../leads/leads.service';
import { LineaProducto } from '../lineas/linea-producto.entity';
import { Miembro } from '../miembros/miembro.entity';
import { Bloqueo } from './bloqueo.entity';
import { Cita, EstadoCita } from './cita.entity';
import { Horario } from './horario.entity';
import { diaLocal, huecos, Rango } from './huecos';

const MIN = 60_000;
const DIAS_A_OFRECER = 7;
const OPCIONES = 3;
const ANTICIPACION_MIN = 120;
/** Postgres: violación de la restricción EXCLUDE "citas_sin_cruce". */
const CRUCE = '23P01';

export const RELOJ = 'RELOJ';

export type NuevaCita = {
  miembroId: string;
  inicio: string;
  fin?: string;
  leadId?: string;
  titulo: string;
  link?: string;
  notas?: string;
};

const ETAPA_POR_ESTADO: Partial<Record<EstadoCita, Etapa>> = {
  realizada: 'demo_realizada',
  no_asistio: 'no_asistio',
};

export function textoHorario(d: Date, zona: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('es-PE', {
      timeZone: zona,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.weekday} ${p.day} de ${p.month} a las ${p.hour}:${p.minute}`;
}

@Injectable()
export class CalendarioService {
  constructor(
    private readonly db: DataSource,
    private readonly leads: LeadsService,
    private readonly alertas: AlertasService,
    @Optional()
    @Inject(RELOJ)
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  private async config(tenant: string) {
    return (
      (await this.db.getRepository(EmpresaConfig).findOneBy({ tenant })) ??
      configPorDefecto(tenant)
    );
  }

  private async duracion(lead?: Pick<Lead, 'lineaId'> | null) {
    if (!lead?.lineaId) return 30;
    const l = await this.db
      .getRepository(LineaProducto)
      .findOneBy({ id: lead.lineaId });
    return l?.duracionDemoMin ?? 30;
  }

  /** Citas agendadas y bloqueos del miembro que tocan el rango. */
  private async ocupados(
    miembroId: string,
    desde: Date,
    hasta: Date,
  ): Promise<Rango[]> {
    const [citas, bloqueos] = await Promise.all([
      this.db.getRepository(Cita).findBy({
        miembroId,
        estado: 'agendada',
        inicio: LessThan(hasta),
        fin: MoreThan(desde),
      }),
      this.db.getRepository(Bloqueo).findBy({
        miembroId,
        inicio: LessThan(hasta),
        fin: MoreThan(desde),
      }),
    ]);
    return [...citas, ...bloqueos];
  }

  // ---- La IA ofrece y reserva ----

  /** Gancho del agente: hasta 3 horarios (el primero libre de cada día) de los comerciales del lead. */
  async ofrecer(conv: Conversacion, lead: Lead): Promise<string[]> {
    const candidatos = await this.leads.candidatos(lead);
    if (!candidatos.length) return [];
    const config = await this.config(conv.tenant);
    const duracionMin = await this.duracion(lead);
    const desde = this.ahora();
    const hasta = new Date(desde.getTime() + DIAS_A_OFRECER * 24 * 60 * MIN);

    const porInicio = new Map<number, string>();
    for (const miembroId of candidatos) {
      const horarios = await this.db
        .getRepository(Horario)
        .findBy({ miembroId });
      if (!horarios.length) continue;
      const libres = huecos({
        zona: config.zonaHoraria,
        duracionMin,
        margenMin: config.margenCitasMin,
        avisoMin: ANTICIPACION_MIN,
        pasoMin: 30,
        horarios,
        ocupados: await this.ocupados(miembroId, desde, hasta),
        desde,
        hasta,
        ahora: desde,
      });
      // Los candidatos vienen del menos cargado al más: el primero que tenga el hueco se lo queda.
      for (const l of libres)
        if (!porInicio.has(l.getTime())) porInicio.set(l.getTime(), miembroId);
    }

    const dias = new Set<string>();
    const ofrecidos: { texto: string; inicio: string; miembroId: string }[] =
      [];
    for (const t of [...porInicio.keys()].sort((a, b) => a - b)) {
      const dia = diaLocal(new Date(t), config.zonaHoraria).fecha;
      if (dias.has(dia)) continue;
      dias.add(dia);
      ofrecidos.push({
        texto: textoHorario(new Date(t), config.zonaHoraria),
        inicio: new Date(t).toISOString(),
        miembroId: porInicio.get(t)!,
      });
      if (ofrecidos.length === OPCIONES) break;
    }
    await this.db.getRepository(Lead).update(lead.id, {
      horariosOfrecidos: ofrecidos.length ? ofrecidos : null,
    });
    return ofrecidos.map((o) => o.texto);
  }

  /** Gancho del agente: el cliente eligió un horario. null si no coincide con lo ofrecido. */
  async elegir(
    conv: Conversacion,
    lead: Lead,
    elegido: string,
  ): Promise<{ respuesta: string; agendada: boolean } | null> {
    const actual = await this.db
      .getRepository(Lead)
      .createQueryBuilder('l')
      .addSelect('l.horariosOfrecidos')
      .where('l.id = :id', { id: lead.id })
      .getOneOrFail();
    const buscado = elegido.trim().toLowerCase();
    const h = actual.horariosOfrecidos?.find(
      (o) => o.texto.toLowerCase() === buscado,
    );
    if (!h) return null;

    const inicio = new Date(h.inicio);
    const fin = new Date(
      inicio.getTime() + (await this.duracion(actual)) * MIN,
    );
    const contacto =
      conv.contacto ??
      (await this.db
        .getRepository(Contacto)
        .findOneByOrFail({ id: conv.contactoId }));
    try {
      await this.db.transaction(async (em) => {
        await em.insert(Cita, {
          tenant: conv.tenant,
          leadId: lead.id,
          miembroId: h.miembroId,
          inicio,
          fin,
          origen: 'ia',
          titulo: `Demo con ${contacto.nombre}`.slice(0, 200),
        });
        await em.update(Lead, lead.id, {
          duenoId: actual.duenoId ?? h.miembroId,
          horariosOfrecidos: null,
        });
        await anotarEtapa(em, actual, 'demo_agendada', null);
      });
    } catch (e) {
      if ((e as { code?: string }).code !== CRUCE) throw e;
      const otros = await this.ofrecer(conv, actual);
      return {
        agendada: false,
        respuesta: otros.length
          ? `Uy, ese horario se acaba de ocupar. Te puedo ofrecer: ${otros.join(', ')}. ¿Cuál te acomoda?`
          : 'Uy, ese horario se acaba de ocupar. En un momento un asesor te escribe para coordinar.',
      };
    }
    await this.leads.emitir(lead.id, conv.id, conv.tenant);
    await this.alertas.avisar(conv.tenant, [h.miembroId], {
      tipo: 'demo_agendada',
      titulo: `Demo con ${contacto.nombre}`,
      detalle: h.texto,
      enlace: `/bandeja?c=${conv.id}`,
    });
    return {
      agendada: true,
      respuesta: `¡Listo! Tu demo quedó agendada para el ${h.texto}. Un asesor te escribirá para confirmarte el enlace.`,
    };
  }

  // ---- Citas desde la app ----

  private async exigirMiembro(m: Miembro, miembroId: string) {
    if (m.rol !== 'gerente' && miembroId !== m.id)
      throw new ForbiddenException(
        'Solo un gerente maneja el calendario de otro',
      );
    const existe = await this.db
      .getRepository(Miembro)
      .exists({ where: { id: miembroId, tenant: m.tenant, estado: 'activo' } });
    if (!existe) throw new BadRequestException('Miembro no encontrado');
  }

  listarCitas(m: Miembro, desde: Date, hasta: Date) {
    return this.db.query(
      `SELECT c.id, c.lead_id AS "leadId", c.miembro_id AS "miembroId", c.inicio, c.fin, c.estado, c.origen,
              c.titulo, c.link, c.notas, l.conversacion_id AS "conversacionId", ct.nombre AS contacto, mi.nombre AS miembro
         FROM citas c
         JOIN miembros mi ON mi.id = c.miembro_id
         LEFT JOIN leads l ON l.id = c.lead_id
         LEFT JOIN contactos ct ON ct.id = l.contacto_id
        WHERE c.tenant = $1 AND c.inicio < $3 AND c.fin > $2 AND ($4 = 'gerente' OR c.miembro_id = $5)
        ORDER BY c.inicio
        LIMIT 1000`,
      [m.tenant, desde, hasta, m.rol, m.id],
    );
  }

  async crearCita(m: Miembro, n: NuevaCita): Promise<Cita> {
    await this.exigirMiembro(m, n.miembroId);
    const lead = n.leadId ? await this.leads.uno(m, n.leadId) : null;
    const inicio = new Date(n.inicio);
    const fin = n.fin
      ? new Date(n.fin)
      : new Date(inicio.getTime() + (await this.duracion(lead)) * MIN);
    if (!(fin > inicio))
      throw new BadRequestException('La cita debe terminar después de empezar');

    const cita = await this.conCruce(() =>
      this.db.transaction(async (em) => {
        const c = await em.save(
          em.create(Cita, {
            tenant: m.tenant,
            leadId: lead?.id ?? null,
            miembroId: n.miembroId,
            inicio,
            fin,
            titulo: n.titulo,
            link: n.link ?? null,
            notas: n.notas ?? null,
          }),
        );
        if (lead) {
          if (!lead.duenoId)
            await em.update(Lead, lead.id, { duenoId: n.miembroId });
          await anotarEtapa(em, lead, 'demo_agendada', m.id);
        }
        return c;
      }),
    );
    if (lead) await this.leads.emitir(lead.id, lead.conversacionId, m.tenant);
    return cita;
  }

  private async cita(m: Miembro, id: string): Promise<Cita> {
    const c = await this.db
      .getRepository(Cita)
      .findOneBy({ id, tenant: m.tenant });
    if (!c || (m.rol !== 'gerente' && c.miembroId !== m.id))
      throw new NotFoundException('Cita no encontrada');
    return c;
  }

  async reprogramar(
    m: Miembro,
    id: string,
    inicio: string,
    fin?: string,
  ): Promise<Cita> {
    const c = await this.cita(m, id);
    const i = new Date(inicio);
    const f = fin
      ? new Date(fin)
      : new Date(i.getTime() + (c.fin.getTime() - c.inicio.getTime()));
    if (!(f > i))
      throw new BadRequestException('La cita debe terminar después de empezar');
    await this.conCruce(() =>
      this.db.getRepository(Cita).update(c.id, {
        inicio: i,
        fin: f,
        aviso30: false,
        rec24: false,
        rec2: false,
      }),
    );
    return this.db.getRepository(Cita).findOneByOrFail({ id });
  }

  async cambiarEstado(
    m: Miembro,
    id: string,
    estado: EstadoCita,
  ): Promise<Cita> {
    const c = await this.cita(m, id);
    await this.db.transaction(async (em) => {
      await em.update(Cita, c.id, { estado });
      if (!c.leadId) return;
      const lead = await em.findOneByOrFail(Lead, { id: c.leadId });
      const etapa =
        ETAPA_POR_ESTADO[estado] ??
        (estado === 'cancelada' && lead.etapa === 'demo_agendada'
          ? 'en_conversacion'
          : undefined);
      if (etapa) await anotarEtapa(em, lead, etapa, m.id);
    });
    if (c.leadId) {
      const lead = await this.db
        .getRepository(Lead)
        .findOneByOrFail({ id: c.leadId });
      await this.leads.emitir(lead.id, lead.conversacionId, m.tenant);
    }
    return this.db.getRepository(Cita).findOneByOrFail({ id });
  }

  private async conCruce<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if ((e as { code?: string }).code === CRUCE)
        throw new ConflictException('Ese horario ya está ocupado');
      throw e;
    }
  }

  // ---- Horario semanal y bloqueos ----

  async horarios(m: Miembro, miembroId: string) {
    await this.exigirMiembroLectura(m, miembroId);
    return this.db
      .getRepository(Horario)
      .find({ where: { miembroId }, order: { dia: 'ASC', desde: 'ASC' } });
  }

  private async exigirMiembroLectura(m: Miembro, miembroId: string) {
    const existe = await this.db
      .getRepository(Miembro)
      .exists({ where: { id: miembroId, tenant: m.tenant } });
    if (!existe) throw new NotFoundException('Miembro no encontrado');
  }

  async guardarHorarios(
    m: Miembro,
    miembroId: string,
    franjas: { dia: number; desde: string; hasta: string }[],
  ) {
    await this.exigirMiembro(m, miembroId);
    for (const f of franjas)
      if (f.desde >= f.hasta)
        throw new BadRequestException(
          'Cada franja debe terminar después de empezar',
        );
    await this.db.transaction(async (em) => {
      await em.delete(Horario, { miembroId });
      if (franjas.length)
        await em.insert(
          Horario,
          franjas.map((f) => ({ ...f, miembroId, tenant: m.tenant })),
        );
    });
    return this.horarios(m, miembroId);
  }

  bloqueos(m: Miembro, desde: Date, hasta: Date) {
    return this.db.getRepository(Bloqueo).find({
      where: {
        tenant: m.tenant,
        inicio: LessThan(hasta),
        fin: MoreThan(desde),
        ...(m.rol === 'gerente' ? {} : { miembroId: m.id }),
      },
      order: { inicio: 'ASC' },
    });
  }

  async crearBloqueo(
    m: Miembro,
    b: { miembroId: string; inicio: string; fin: string; motivo?: string },
  ) {
    await this.exigirMiembro(m, b.miembroId);
    const inicio = new Date(b.inicio);
    const fin = new Date(b.fin);
    if (!(fin > inicio))
      throw new BadRequestException(
        'El bloqueo debe terminar después de empezar',
      );
    return this.db.getRepository(Bloqueo).save({
      tenant: m.tenant,
      miembroId: b.miembroId,
      inicio,
      fin,
      motivo: b.motivo ?? '',
    });
  }

  async borrarBloqueo(m: Miembro, id: string) {
    const b = await this.db
      .getRepository(Bloqueo)
      .findOneBy({ id, tenant: m.tenant });
    if (!b || (m.rol !== 'gerente' && b.miembroId !== m.id))
      throw new NotFoundException('Bloqueo no encontrado');
    await this.db.getRepository(Bloqueo).delete(id);
  }
}
