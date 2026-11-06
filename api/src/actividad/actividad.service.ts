import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Not } from 'typeorm';
import { AlertasService } from '../alertas/alertas.service';
import { Contacto } from '../bandeja/contacto.entity';
import { Cita } from '../calendario/cita.entity';
import { LeadHistorial } from '../leads/lead-historial.entity';
import { Lead } from '../leads/lead.entity';
import { FiltroTabla, LeadsService } from '../leads/leads.service';
import { Miembro } from '../miembros/miembro.entity';
import { Nota } from './nota.entity';
import { EstadoTarea, Tarea } from './tarea.entity';
import { Vista } from './vista.entity';

export type NuevaTarea = {
  titulo: string;
  venceEn?: string | null;
  responsableId?: string;
};
export type CambioTarea = Partial<NuevaTarea> & { estado?: EstadoTarea };

export type ItemLinea =
  | ({ tipo: 'etapa'; en: Date } & Pick<
      LeadHistorial,
      'id' | 'de' | 'a' | 'miembroId'
    >)
  | ({ tipo: 'nota'; en: Date } & Pick<
      Nota,
      'id' | 'texto' | 'autorId' | 'menciones'
    >)
  | ({ tipo: 'tarea'; en: Date } & Pick<
      Tarea,
      | 'id'
      | 'titulo'
      | 'venceEn'
      | 'estado'
      | 'responsableId'
      | 'origen'
      | 'hechaEn'
    >)
  | ({ tipo: 'cita'; en: Date } & Pick<
      Cita,
      'id' | 'titulo' | 'estado' | 'miembroId' | 'fin'
    >);

const MENCION = /@([\w.-]+)/g;

/** Lo que el equipo hace sobre un lead además del chat: notas, tareas y vistas de la tabla. */
@Injectable()
export class ActividadService {
  constructor(
    private readonly db: DataSource,
    private readonly leads: LeadsService,
    private readonly alertas: AlertasService,
  ) {}

  /** Mismo criterio que la tabla: el gerente ve todo; un comercial, lo suyo y lo que no tiene dueño. */
  private ve(m: Pick<Miembro, 'id' | 'rol'>, lead: Pick<Lead, 'duenoId'>) {
    return m.rol === 'gerente' || !lead.duenoId || lead.duenoId === m.id;
  }

  private async leadConContacto(m: Miembro, id: string) {
    const lead = await this.leads.uno(m, id);
    const contacto = await this.db
      .getRepository(Contacto)
      .findOneBy({ id: lead.contactoId });
    return { lead, nombre: contacto?.nombre ?? 'un lead' };
  }

  // ---- Notas ----

  async crearNota(m: Miembro, leadId: string, texto: string): Promise<Nota> {
    const { lead, nombre } = await this.leadConContacto(m, leadId);
    const usuarios = [...texto.matchAll(MENCION)].map((x) =>
      x[1].toLowerCase(),
    );
    const mencionados = usuarios.length
      ? (
          await this.db.getRepository(Miembro).findBy({
            tenant: m.tenant,
            estado: 'activo',
            id: Not(m.id),
          })
        ).filter(
          (x) =>
            usuarios.includes(x.username.toLowerCase()) && this.ve(x, lead),
        )
      : [];
    const nota = await this.db.getRepository(Nota).save({
      tenant: m.tenant,
      leadId,
      autorId: m.id,
      texto,
      menciones: mencionados.map((x) => x.id),
    });
    if (mencionados.length)
      await this.alertas.avisar(m.tenant, nota.menciones, {
        tipo: 'mencion',
        titulo: `${m.nombre} te mencionó en ${nombre}`,
        detalle: texto.slice(0, 300),
        enlace: `/leads/${leadId}`,
      });
    return nota;
  }

  async borrarNota(m: Miembro, id: string): Promise<void> {
    const nota = await this.db
      .getRepository(Nota)
      .findOneBy({ id, tenant: m.tenant });
    if (!nota) throw new NotFoundException('Nota no encontrada');
    if (nota.autorId !== m.id && m.rol !== 'gerente')
      throw new ForbiddenException(
        'Solo quien la escribió o un gerente la borra',
      );
    await this.db.getRepository(Nota).delete(id);
  }

  // ---- Tareas ----

  /** El responsable tiene que ser un miembro activo que vea el lead; si no se indica, es quien la crea. */
  private async responsable(m: Miembro, lead: Lead, id?: string) {
    if (!id || id === m.id) return m.id;
    const r = await this.db
      .getRepository(Miembro)
      .findOneBy({ id, tenant: m.tenant, estado: 'activo' });
    if (!r)
      throw new BadRequestException(
        'El responsable debe ser un miembro activo',
      );
    if (!this.ve(r, lead))
      throw new BadRequestException(
        `${r.nombre} no ve este lead: asígnaselo primero`,
      );
    return r.id;
  }

  private async avisarAsignada(m: Miembro, t: Tarea) {
    if (t.responsableId === m.id) return;
    await this.alertas.avisar(m.tenant, [t.responsableId], {
      tipo: 'tarea_asignada',
      titulo: `${m.nombre} te asignó: ${t.titulo}`,
      detalle: t.venceEn ? `Vence ${t.venceEn.toISOString()}` : '',
      enlace: `/leads/${t.leadId}`,
    });
  }

  async crearTarea(m: Miembro, leadId: string, n: NuevaTarea): Promise<Tarea> {
    const lead = await this.leads.uno(m, leadId);
    const tarea = await this.db.getRepository(Tarea).save({
      tenant: m.tenant,
      leadId,
      titulo: n.titulo,
      venceEn: n.venceEn ? new Date(n.venceEn) : null,
      responsableId: await this.responsable(m, lead, n.responsableId),
      creadorId: m.id,
    });
    await this.avisarAsignada(m, tarea);
    return tarea;
  }

  /** La cambia el gerente, su responsable o quien la creó. */
  async actualizarTarea(
    m: Miembro,
    id: string,
    c: CambioTarea,
  ): Promise<Tarea> {
    const repo = this.db.getRepository(Tarea);
    const t = await repo.findOneBy({ id, tenant: m.tenant });
    if (
      !t ||
      (m.rol !== 'gerente' && t.responsableId !== m.id && t.creadorId !== m.id)
    )
      throw new NotFoundException('Tarea no encontrada');
    const cambios: Partial<Tarea> = {};
    if (c.titulo !== undefined) cambios.titulo = c.titulo;
    if (c.venceEn !== undefined) {
      cambios.venceEn = c.venceEn ? new Date(c.venceEn) : null;
      cambios.avisoVencida = false;
    }
    if (c.estado !== undefined && c.estado !== t.estado) {
      cambios.estado = c.estado;
      cambios.hechaEn = c.estado === 'hecha' ? new Date() : null;
    }
    const otroResponsable =
      c.responsableId !== undefined && c.responsableId !== t.responsableId;
    if (otroResponsable) {
      const lead = await this.db
        .getRepository(Lead)
        .findOneByOrFail({ id: t.leadId });
      cambios.responsableId = await this.responsable(m, lead, c.responsableId);
    }
    if (Object.keys(cambios).length) await repo.update(id, cambios);
    const nueva = await repo.findOneByOrFail({ id });
    if (otroResponsable) await this.avisarAsignada(m, nueva);
    return nueva;
  }

  /** Pendientes: la vencida primero y las sin fecha al final. Hechas: la más reciente primero. */
  tareas(
    m: Miembro,
    f: { estado: EstadoTarea; todas?: boolean },
  ): Promise<Tarea[]> {
    return this.db.getRepository(Tarea).find({
      where: {
        tenant: m.tenant,
        estado: f.estado,
        ...(f.todas && m.rol === 'gerente' ? {} : { responsableId: m.id }),
      },
      relations: { lead: { contacto: true } },
      order:
        f.estado === 'pendiente'
          ? { venceEn: { direction: 'ASC', nulls: 'LAST' }, createdAt: 'ASC' }
          : { hechaEn: 'DESC' },
      take: 200,
    });
  }

  /** Barrido: avisa una vez al responsable de cada tarea que venció sin hacerse. */
  async avisarVencidas(ahora: Date): Promise<void> {
    const [filas]: [
      {
        tenant: string;
        lead_id: string;
        titulo: string;
        responsable_id: string;
      }[],
      number,
    ] = await this.db.query(
      `UPDATE tareas SET aviso_vencida = true
        WHERE estado = 'pendiente' AND NOT aviso_vencida AND vence_en < $1
        RETURNING tenant, lead_id, titulo, responsable_id`,
      [ahora],
    );
    for (const t of filas)
      await this.alertas.avisar(t.tenant, [t.responsable_id], {
        tipo: 'tarea_vencida',
        titulo: `Venció: ${t.titulo}`,
        enlace: `/leads/${t.lead_id}`,
      });
  }

  // ---- Línea de tiempo ----

  async lineaDeTiempo(m: Miembro, leadId: string): Promise<ItemLinea[]> {
    await this.leads.uno(m, leadId);
    const [etapas, notas, tareas, citas] = await Promise.all([
      this.db.getRepository(LeadHistorial).findBy({ leadId }),
      this.db.getRepository(Nota).findBy({ leadId }),
      this.db.getRepository(Tarea).findBy({ leadId, estado: Not('cancelada') }),
      this.db.getRepository(Cita).findBy({ leadId }),
    ]);
    const items: ItemLinea[] = [
      ...etapas.map((e) => ({
        tipo: 'etapa' as const,
        en: e.en,
        id: e.id,
        de: e.de,
        a: e.a,
        miembroId: e.miembroId,
      })),
      ...notas.map((n) => ({
        tipo: 'nota' as const,
        en: n.createdAt,
        id: n.id,
        texto: n.texto,
        autorId: n.autorId,
        menciones: n.menciones,
      })),
      ...tareas.map((t) => ({
        tipo: 'tarea' as const,
        en: t.createdAt,
        id: t.id,
        titulo: t.titulo,
        venceEn: t.venceEn,
        estado: t.estado,
        responsableId: t.responsableId,
        origen: t.origen,
        hechaEn: t.hechaEn,
      })),
      ...citas.map((c) => ({
        tipo: 'cita' as const,
        en: c.inicio,
        id: c.id,
        titulo: c.titulo,
        estado: c.estado,
        miembroId: c.miembroId,
        fin: c.fin,
      })),
    ];
    return items.sort((a, b) => b.en.getTime() - a.en.getTime());
  }

  // ---- Vistas de la tabla ----

  vistas(m: Miembro): Promise<Vista[]> {
    return this.db.getRepository(Vista).find({
      where: [
        { tenant: m.tenant, miembroId: m.id },
        { tenant: m.tenant, compartida: true },
      ],
      order: { createdAt: 'ASC' },
    });
  }

  guardarVista(
    m: Miembro,
    v: { nombre: string; filtros: FiltroTabla; compartida: boolean },
  ): Promise<Vista> {
    // La página no se guarda: una vista abre siempre en la primera.
    const filtros = { ...v.filtros };
    delete filtros.pagina;
    return this.db.getRepository(Vista).save({
      tenant: m.tenant,
      miembroId: m.id,
      nombre: v.nombre,
      filtros,
      compartida: v.compartida,
    });
  }

  /** La borra quien la creó; una compartida, también un gerente. */
  async borrarVista(m: Miembro, id: string): Promise<void> {
    const repo = this.db.getRepository(Vista);
    const v = await repo.findOneBy({ id, tenant: m.tenant });
    if (!v || (v.miembroId !== m.id && !(v.compartida && m.rol === 'gerente')))
      throw new NotFoundException('Vista no encontrada');
    await repo.delete(id);
  }
}
