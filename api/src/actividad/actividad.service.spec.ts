import { DataSource } from 'typeorm';
import { limpiarBase } from '../../test/util/app';
import { crearDbTest } from '../../test/util/db';
import { crearNumero, payloadTexto } from '../../test/util/whatsapp';
import { AlertasService } from '../alertas/alertas.service';
import { Conversacion } from '../bandeja/conversacion.entity';
import { EntrantesService } from '../bandeja/entrantes.service';
import { EventosService } from '../bandeja/eventos.service';
import { Cita } from '../calendario/cita.entity';
import { Lead } from '../leads/lead.entity';
import { anotarEtapa, LeadsService } from '../leads/leads.service';
import { Miembro } from '../miembros/miembro.entity';
import { ActividadService } from './actividad.service';
import { Tarea } from './tarea.entity';

describe('ActividadService', () => {
  let db: DataSource;
  let entrantes: EntrantesService;
  let avisos: { ids: string[]; tipo: string; titulo: string }[];
  let actividad: ActividadService;
  let gerente: Miembro;
  let ana: Miembro;
  let beto: Miembro;

  beforeAll(async () => (db = await crearDbTest()));
  afterAll(() => db.destroy());

  beforeEach(async () => {
    await limpiarBase(db);
    const eventos = new EventosService();
    entrantes = new EntrantesService(db, eventos);
    avisos = [];
    const alertas = {
      avisar: async (
        _t: string,
        ids: string[],
        a: { tipo: string; titulo: string },
      ) => {
        avisos.push({ ids, tipo: a.tipo, titulo: a.titulo });
      },
      gerentes: async () => [gerente.id],
    } as unknown as AlertasService;
    const leads = new LeadsService(db, eventos, alertas);
    actividad = new ActividadService(db, leads, alertas);
    await crearNumero(db, 't', 'ph1');
    const m = (username: string, rol: 'gerente' | 'comercial') =>
      db.getRepository(Miembro).save({
        tenant: 't',
        userId: username,
        username,
        nombre: username.toUpperCase(),
        rol,
        estado: 'activo',
      });
    gerente = await m('gere', 'gerente');
    ana = await m('ana', 'comercial');
    beto = await m('beto', 'comercial');
  });

  const nuevoLead = async (from = '51911', duenoId: string | null = null) => {
    await entrantes.procesar(
      payloadTexto('ph1', 'wamid.' + from, 'Hola', from),
    );
    const conv = await db.getRepository(Conversacion).findOneOrFail({
      where: { contacto: { telefono: from } },
    });
    const lead = await db
      .getRepository(Lead)
      .findOneByOrFail({ conversacionId: conv.id });
    if (duenoId) await db.getRepository(Lead).update(lead.id, { duenoId });
    return db.getRepository(Lead).findOneByOrFail({ id: lead.id });
  };

  it('una nota con @usuario avisa a los mencionados que pueden ver el lead, no al autor', async () => {
    const lead = await nuevoLead('51911', ana.id);
    const nota = await actividad.crearNota(
      gerente,
      lead.id,
      'Llamé al cliente. Revisa precios, @ana. @gere y @beto ojo, @nadie',
    );
    expect(nota.menciones).toEqual([ana.id]);
    expect(avisos).toEqual([
      { ids: [ana.id], tipo: 'mencion', titulo: 'GERE te mencionó en Rosa' },
    ]);
  });

  it('un comercial no anota en leads de otro', async () => {
    const lead = await nuevoLead('51911', ana.id);
    await expect(actividad.crearNota(beto, lead.id, 'hola')).rejects.toThrow(
      'Lead no encontrado',
    );
  });

  it('solo el autor o un gerente borra una nota', async () => {
    const lead = await nuevoLead('51911');
    const nota = await actividad.crearNota(ana, lead.id, 'nota de ana');
    await expect(actividad.borrarNota(beto, nota.id)).rejects.toThrow(
      'Solo quien la escribió',
    );
    await actividad.borrarNota(gerente, nota.id);
    expect(await actividad.lineaDeTiempo(gerente, lead.id)).toEqual([]);
  });

  it('una tarea para otro miembro le avisa; si es para uno mismo no', async () => {
    const lead = await nuevoLead('51911', ana.id);
    await actividad.crearTarea(ana, lead.id, { titulo: 'Llamar' });
    expect(avisos).toEqual([]);
    const t = await actividad.crearTarea(gerente, lead.id, {
      titulo: 'Mandar propuesta',
      venceEn: '2030-01-02T15:00:00Z',
      responsableId: ana.id,
    });
    expect(t).toMatchObject({ responsableId: ana.id, estado: 'pendiente' });
    expect(avisos).toEqual([
      {
        ids: [ana.id],
        tipo: 'tarea_asignada',
        titulo: 'GERE te asignó: Mandar propuesta',
      },
    ]);
  });

  it('el responsable de una tarea debe poder ver el lead', async () => {
    const lead = await nuevoLead('51911', ana.id);
    await expect(
      actividad.crearTarea(gerente, lead.id, {
        titulo: 'x',
        responsableId: beto.id,
      }),
    ).rejects.toThrow('no ve este lead');
  });

  it('completar una tarea guarda cuándo; reabrirla lo borra', async () => {
    const lead = await nuevoLead('51911', ana.id);
    const t = await actividad.crearTarea(ana, lead.id, { titulo: 'Llamar' });
    const hecha = await actividad.actualizarTarea(ana, t.id, {
      estado: 'hecha',
    });
    expect(hecha.hechaEn).toBeInstanceOf(Date);
    const otra = await actividad.actualizarTarea(ana, t.id, {
      estado: 'pendiente',
    });
    expect(otra.hechaEn).toBeNull();
    await expect(
      actividad.actualizarTarea(beto, t.id, { estado: 'hecha' }),
    ).rejects.toThrow('Tarea no encontrada');
  });

  it('mis tareas: el comercial ve las suyas pendientes, la vencida primero; el gerente puede ver todas', async () => {
    const lead = await nuevoLead('51911', ana.id);
    await actividad.crearTarea(ana, lead.id, {
      titulo: 'Después',
      venceEn: '2030-01-05T00:00:00Z',
    });
    await actividad.crearTarea(ana, lead.id, {
      titulo: 'Antes',
      venceEn: '2030-01-01T00:00:00Z',
    });
    await actividad.crearTarea(gerente, lead.id, { titulo: 'Del gerente' });
    const deAna = await actividad.tareas(ana, { estado: 'pendiente' });
    expect(deAna.map((t) => t.titulo)).toEqual(['Antes', 'Después']);
    expect(deAna[0].lead).toMatchObject({ id: lead.id });
    expect(
      (await actividad.tareas(ana, { estado: 'pendiente', todas: true }))
        .length,
    ).toBe(2);
    expect(
      (await actividad.tareas(gerente, { estado: 'pendiente', todas: true }))
        .length,
    ).toBe(3);
  });

  it('la línea de tiempo junta etapas, notas, tareas y citas, de la más nueva a la más vieja', async () => {
    const lead = await nuevoLead('51911', ana.id);
    await db.transaction((em) =>
      anotarEtapa(em, lead, 'en_conversacion', ana.id),
    );
    await new Promise((r) => setTimeout(r, 5));
    await actividad.crearNota(ana, lead.id, 'nota');
    await new Promise((r) => setTimeout(r, 5));
    await actividad.crearTarea(ana, lead.id, { titulo: 'tarea' });
    await db.getRepository(Cita).save({
      tenant: 't',
      leadId: lead.id,
      miembroId: ana.id,
      inicio: new Date(Date.now() + 86_400_000),
      fin: new Date(Date.now() + 90_000_000),
    });
    const tl = await actividad.lineaDeTiempo(ana, lead.id);
    expect(tl.map((x) => x.tipo)).toEqual(['cita', 'tarea', 'nota', 'etapa']);
    expect(tl[3]).toMatchObject({ de: 'nuevo', a: 'en_conversacion' });
  });

  it('automatización: no asistió, demo realizada y ganado crean la tarea siguiente para el dueño', async () => {
    const lead = await nuevoLead('51911', ana.id);
    const pasar = async (a: Lead['etapa']) => {
      const l = await db.getRepository(Lead).findOneByOrFail({ id: lead.id });
      await db.transaction((em) => anotarEtapa(em, l, a, null));
    };
    await pasar('no_asistio');
    await pasar('demo_realizada');
    await pasar('ganado');
    const tareas = await db
      .getRepository(Tarea)
      .find({ where: { leadId: lead.id }, order: { createdAt: 'ASC' } });
    expect(tareas.map((t) => [t.titulo, t.responsableId, t.origen])).toEqual([
      ['Reagendar la demo', ana.id, 'auto'],
      ['Enviar la propuesta y cerrar', ana.id, 'auto'],
      ['Dar de alta al cliente en ARP', ana.id, 'auto'],
    ]);
    expect(tareas.every((t) => t.venceEn)).toBe(true);
  });

  it('automatización: perder el lead cancela sus tareas automáticas pendientes, no las manuales', async () => {
    const lead = await nuevoLead('51911', ana.id);
    await db.transaction((em) => anotarEtapa(em, lead, 'no_asistio', null));
    await actividad.crearTarea(ana, lead.id, { titulo: 'Mía' });
    const l = await db.getRepository(Lead).findOneByOrFail({ id: lead.id });
    await db.transaction((em) => anotarEtapa(em, l, 'perdido', ana.id));
    const tareas = await db
      .getRepository(Tarea)
      .find({ where: { leadId: lead.id }, order: { createdAt: 'ASC' } });
    expect(tareas.map((t) => [t.titulo, t.estado])).toEqual([
      ['Reagendar la demo', 'cancelada'],
      ['Mía', 'pendiente'],
    ]);
  });

  it('sin dueño, la automatización no crea tareas', async () => {
    const lead = await nuevoLead('51911');
    await db.transaction((em) => anotarEtapa(em, lead, 'no_asistio', null));
    expect(await db.getRepository(Tarea).count()).toBe(0);
  });

  it('avisa una sola vez de cada tarea vencida', async () => {
    const lead = await nuevoLead('51911', ana.id);
    await actividad.crearTarea(ana, lead.id, {
      titulo: 'Llamar',
      venceEn: '2020-01-01T00:00:00Z',
    });
    await actividad.crearTarea(ana, lead.id, {
      titulo: 'Futura',
      venceEn: '2099-01-01T00:00:00Z',
    });
    await actividad.avisarVencidas(new Date());
    await actividad.avisarVencidas(new Date());
    expect(avisos).toEqual([
      { ids: [ana.id], tipo: 'tarea_vencida', titulo: 'Venció: Llamar' },
    ]);
  });

  it('vistas guardadas: propias y compartidas; solo el dueño o un gerente borra', async () => {
    const propia = await actividad.guardarVista(ana, {
      nombre: 'Mis demos',
      filtros: { etapas: ['demo_agendada'] },
      compartida: false,
    });
    const comun = await actividad.guardarVista(gerente, {
      nombre: 'Sin dueño',
      filtros: { duenoId: 'sin' },
      compartida: true,
    });
    await actividad.guardarVista(gerente, {
      nombre: 'Privada del gerente',
      filtros: {},
      compartida: false,
    });
    expect((await actividad.vistas(ana)).map((v) => v.nombre)).toEqual([
      'Mis demos',
      'Sin dueño',
    ]);
    await expect(actividad.borrarVista(beto, propia.id)).rejects.toThrow(
      'Vista no encontrada',
    );
    await expect(actividad.borrarVista(ana, comun.id)).rejects.toThrow(
      'Vista no encontrada',
    );
    await actividad.borrarVista(ana, propia.id);
    expect((await actividad.vistas(ana)).map((v) => v.nombre)).toEqual([
      'Sin dueño',
    ]);
  });
});
