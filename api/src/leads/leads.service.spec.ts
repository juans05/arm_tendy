import { DataSource } from 'typeorm';
import { limpiarBase } from '../../test/util/app';
import { crearDbTest } from '../../test/util/db';
import { crearNumero, payloadTexto } from '../../test/util/whatsapp';
import { AlertasService } from '../alertas/alertas.service';
import { Conversacion } from '../bandeja/conversacion.entity';
import { EntrantesService } from '../bandeja/entrantes.service';
import { EventosService } from '../bandeja/eventos.service';
import { LineaProducto } from '../lineas/linea-producto.entity';
import { Miembro } from '../miembros/miembro.entity';
import { LeadHistorial } from './lead-historial.entity';
import { Lead } from './lead.entity';
import { anotarEtapa, LeadsService } from './leads.service';

describe('LeadsService', () => {
  let db: DataSource;
  let entrantes: EntrantesService;
  let avisos: { ids: string[]; tipo: string }[];
  let leads: LeadsService;
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
      avisar: async (_t: string, ids: string[], a: { tipo: string }) => {
        avisos.push({ ids, tipo: a.tipo });
      },
      gerentes: async () => [gerente.id],
    } as unknown as AlertasService;
    leads = new LeadsService(db, eventos, alertas);
    await crearNumero(db, 't', 'ph1');
    const repo = db.getRepository(Miembro);
    const m = (
      username: string,
      rol: 'gerente' | 'comercial',
      extra: Partial<Miembro> = {},
    ) =>
      repo.save({
        tenant: 't',
        userId: username,
        username,
        nombre: username,
        rol,
        estado: 'activo',
        ...extra,
      });
    gerente = await m('gere', 'gerente');
    ana = await m('ana', 'comercial', { recibeDemos: true });
    beto = await m('beto', 'comercial', { recibeDemos: true });
  });

  const nuevoLead = async (from = '51911') => {
    await entrantes.procesar(
      payloadTexto('ph1', 'wamid.' + from, 'Hola', from),
    );
    const conv = await db.getRepository(Conversacion).findOneOrFail({
      where: { contacto: { telefono: from } },
      relations: { contacto: true },
    });
    const lead = await db
      .getRepository(Lead)
      .findOneByOrFail({ conversacionId: conv.id });
    return { conv, lead };
  };

  it('al pasar a humano asigna al comercial con menos leads abiertos y le avisa', async () => {
    const a = await nuevoLead('51901');
    await db.getRepository(Lead).update(a.lead.id, { duenoId: ana.id });
    const b = await nuevoLead('51902');
    await leads.asignarAlTraspaso(b.conv, 'pide_humano');
    const lead = await db
      .getRepository(Lead)
      .findOneByOrFail({ id: b.lead.id });
    expect(lead).toMatchObject({
      duenoId: beto.id,
      traspasoMotivo: 'pide_humano',
    });
    expect(lead.traspasoEn).toBeInstanceOf(Date);
    expect(avisos).toEqual([{ ids: [beto.id], tipo: 'lead_asignado' }]);
  });

  it('prefiere a los comerciales de la línea del lead', async () => {
    const linea = await db
      .getRepository(LineaProducto)
      .save({ tenant: 't', nombre: 'Spa', comerciales: [ana] });
    const otro = await nuevoLead('51999');
    await db.getRepository(Lead).update(otro.lead.id, { duenoId: ana.id });
    const { conv, lead } = await nuevoLead();
    await db.getRepository(Lead).update(lead.id, { lineaId: linea.id });
    await leads.asignarAlTraspaso(conv, 'pide_humano');
    expect(
      (await db.getRepository(Lead).findOneByOrFail({ id: lead.id })).duenoId,
    ).toBe(ana.id);
  });

  it('si ya tiene dueño no lo cambia y le avisa a él', async () => {
    const { conv, lead } = await nuevoLead();
    await db.getRepository(Lead).update(lead.id, { duenoId: ana.id });
    await leads.asignarAlTraspaso(conv, 'pide_humano');
    expect(
      (await db.getRepository(Lead).findOneByOrFail({ id: lead.id })).duenoId,
    ).toBe(ana.id);
    expect(avisos).toEqual([{ ids: [ana.id], tipo: 'lead_asignado' }]);
  });

  it('sin comerciales disponibles avisa al gerente y deja el lead sin dueño', async () => {
    await db
      .getRepository(Miembro)
      .update({ rol: 'comercial' }, { recibeDemos: false });
    const { conv, lead } = await nuevoLead();
    await leads.asignarAlTraspaso(conv, 'molesto');
    expect(
      (await db.getRepository(Lead).findOneByOrFail({ id: lead.id })).duenoId,
    ).toBeNull();
    expect(avisos).toEqual([{ ids: [gerente.id], tipo: 'lead_asignado' }]);
  });

  it('cambiar de etapa deja historial; ganado exige monto y perdido exige motivo', async () => {
    const { lead } = await nuevoLead();
    await expect(
      leads.actualizar(gerente, lead.id, { etapa: 'ganado' }),
    ).rejects.toThrow('monto');
    await expect(
      leads.actualizar(gerente, lead.id, { etapa: 'perdido' }),
    ).rejects.toThrow('motivo');
    const r = await leads.actualizar(gerente, lead.id, {
      etapa: 'ganado',
      monto: 1200,
      plan: 'Pro',
    });
    expect(r).toMatchObject({ etapa: 'ganado', monto: 1200, plan: 'Pro' });
    expect(await db.getRepository(LeadHistorial).find()).toEqual([
      expect.objectContaining({
        de: 'nuevo',
        a: 'ganado',
        miembroId: gerente.id,
      }),
    ]);
  });

  it('el dueño debe ser un miembro activo de la empresa', async () => {
    const { lead } = await nuevoLead();
    await db.getRepository(Miembro).update(beto.id, { estado: 'inactivo' });
    await expect(
      leads.actualizar(gerente, lead.id, { duenoId: beto.id }),
    ).rejects.toThrow('miembro');
  });

  it('un comercial ve sus leads y los sin dueño, y no toca los de otro', async () => {
    const a = await nuevoLead('51901');
    const b = await nuevoLead('51902');
    await nuevoLead('51903');
    await db.getRepository(Lead).update(a.lead.id, { duenoId: ana.id });
    await db.getRepository(Lead).update(b.lead.id, { duenoId: beto.id });
    const vistos = await leads.listar(ana, {});
    expect(vistos).toHaveLength(2);
    expect(vistos.map((l) => l.id)).not.toContain(b.lead.id);
    expect(await leads.listar(gerente, {})).toHaveLength(3);
    await expect(
      leads.actualizar(ana, b.lead.id, { etapa: 'seguimiento' }),
    ).rejects.toThrow('no encontrado');
    await expect(
      leads.actualizar(ana, a.lead.id, { duenoId: beto.id }),
    ).rejects.toThrow('gerente');
  });

  it('listar filtra por etapa y trae el contacto', async () => {
    const { lead } = await nuevoLead();
    await nuevoLead('51902');
    await leads.actualizar(gerente, lead.id, { etapa: 'seguimiento' });
    const r = await leads.listar(gerente, { etapa: 'seguimiento' });
    expect(r).toEqual([
      expect.objectContaining({
        id: lead.id,
        contacto: expect.objectContaining({ telefono: '51911' }),
      }),
    ]);
  });

  it('un cambio de etapa con datos viejos no pisa el que hizo una persona entretanto', async () => {
    const { lead: viejo } = await nuevoLead();
    await leads.actualizar(gerente, viejo.id, {
      etapa: 'perdido',
      motivo: 'precio',
    });
    await db.transaction((em) =>
      anotarEtapa(em, viejo, 'en_conversacion', null),
    );
    expect(
      (await db.getRepository(Lead).findOneByOrFail({ id: viejo.id })).etapa,
    ).toBe('perdido');
    expect(
      await db
        .getRepository(LeadHistorial)
        .countBy({ leadId: viejo.id, a: 'en_conversacion' }),
    ).toBe(0);
  });
});
