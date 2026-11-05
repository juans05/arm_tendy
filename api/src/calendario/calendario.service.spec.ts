import { DataSource } from 'typeorm';
import { limpiarBase } from '../../test/util/app';
import { crearDbTest } from '../../test/util/db';
import { crearNumero, payloadTexto } from '../../test/util/whatsapp';
import { AlertasService } from '../alertas/alertas.service';
import { Conversacion } from '../bandeja/conversacion.entity';
import { EntrantesService } from '../bandeja/entrantes.service';
import { EventosService } from '../bandeja/eventos.service';
import { Lead } from '../leads/lead.entity';
import { LeadsService } from '../leads/leads.service';
import { Miembro } from '../miembros/miembro.entity';
import { Cita } from './cita.entity';
import { CalendarioService } from './calendario.service';
import { Horario } from './horario.entity';

describe('CalendarioService', () => {
  let db: DataSource;
  let entrantes: EntrantesService;
  let avisos: { ids: string[]; tipo: string }[];
  let cal: CalendarioService;
  let gerente: Miembro;
  let ana: Miembro;
  // Domingo 8 de noviembre de 2026, 12:00 en Lima.
  const ahora = new Date('2026-11-08T12:00:00-05:00');

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
    const leads = new LeadsService(db, eventos, alertas);
    cal = new CalendarioService(db, leads, alertas, () => ahora);
    await crearNumero(db, 't', 'ph1');
    const repo = db.getRepository(Miembro);
    gerente = await repo.save({
      tenant: 't',
      userId: 'g',
      username: 'g',
      nombre: 'Gere',
      rol: 'gerente',
      estado: 'activo',
    });
    ana = await repo.save({
      tenant: 't',
      userId: 'a',
      username: 'ana',
      nombre: 'Ana',
      rol: 'comercial',
      estado: 'activo',
      recibeDemos: true,
    });
    // Ana atiende lunes y martes de 09:00 a 10:00.
    await db.getRepository(Horario).save([
      {
        tenant: 't',
        miembroId: ana.id,
        dia: 1,
        desde: '09:00',
        hasta: '10:00',
      },
      {
        tenant: 't',
        miembroId: ana.id,
        dia: 2,
        desde: '09:00',
        hasta: '10:00',
      },
    ]);
  });

  const nuevoLead = async () => {
    await entrantes.procesar(payloadTexto('ph1', 'wamid.1', 'Hola'));
    const conv = await db.getRepository(Conversacion).findOneOrFail({
      where: {},
      relations: { contacto: true, numero: true },
    });
    const lead = await db
      .getRepository(Lead)
      .findOneByOrFail({ conversacionId: conv.id });
    return { conv, lead };
  };

  it('ofrece el primer horario libre de cada día y los recuerda en el lead', async () => {
    const { conv, lead } = await nuevoLead();
    const textos = await cal.ofrecer(conv, lead);
    expect(textos).toHaveLength(2);
    expect(textos[0]).toMatch(/lunes 9.*09:00/i);
    const guardado = await db
      .getRepository(Lead)
      .createQueryBuilder('l')
      .addSelect('l.horariosOfrecidos')
      .where('l.id = :id', { id: lead.id })
      .getOneOrFail();
    expect(guardado.horariosOfrecidos?.[0]).toMatchObject({
      texto: textos[0],
      inicio: '2026-11-09T14:00:00.000Z',
      miembroId: ana.id,
    });
  });

  it('al elegir un horario ofrecido agenda la cita, mueve el lead y avisa al comercial', async () => {
    const { conv, lead } = await nuevoLead();
    const [primero] = await cal.ofrecer(conv, lead);
    const r = await cal.elegir(conv, lead, primero);
    expect(r?.agendada).toBe(true);
    expect(r?.respuesta).toContain('09:00');
    const cita = await db.getRepository(Cita).findOneByOrFail({});
    expect(cita).toMatchObject({
      miembroId: ana.id,
      origen: 'ia',
      leadId: lead.id,
    });
    expect(
      await db.getRepository(Lead).findOneByOrFail({ id: lead.id }),
    ).toMatchObject({ etapa: 'demo_agendada', duenoId: ana.id });
    expect(avisos).toEqual([{ ids: [ana.id], tipo: 'demo_agendada' }]);
  });

  it('si el horario se ocupó mientras tanto, no agenda y lo dice', async () => {
    const { conv, lead } = await nuevoLead();
    const [primero] = await cal.ofrecer(conv, lead);
    await cal.crearCita(gerente, {
      miembroId: ana.id,
      inicio: '2026-11-09T14:00:00.000Z',
      titulo: 'Otra demo',
    });
    const r = await cal.elegir(conv, lead, primero);
    expect(r?.agendada).toBe(false);
    expect(await db.getRepository(Cita).count()).toBe(1);
  });

  it('un horario que no se ofreció se ignora', async () => {
    const { conv, lead } = await nuevoLead();
    await cal.ofrecer(conv, lead);
    expect(await cal.elegir(conv, lead, 'jueves a las 3')).toBeNull();
  });

  it('la base no deja cruzar dos citas del mismo comercial', async () => {
    await cal.crearCita(gerente, {
      miembroId: ana.id,
      inicio: '2026-11-09T14:00:00.000Z',
      titulo: 'A',
    });
    await expect(
      cal.crearCita(gerente, {
        miembroId: ana.id,
        inicio: '2026-11-09T14:15:00.000Z',
        titulo: 'B',
      }),
    ).rejects.toThrow('ocupado');
  });

  it('un comercial no agenda en el calendario de otro', async () => {
    await expect(
      cal.crearCita(ana, {
        miembroId: gerente.id,
        inicio: '2026-11-09T14:00:00.000Z',
        titulo: 'A',
      }),
    ).rejects.toThrow('gerente');
  });

  it('marcar la demo como realizada o no asistió mueve el lead', async () => {
    const { conv, lead } = await nuevoLead();
    const [primero] = await cal.ofrecer(conv, lead);
    await cal.elegir(conv, lead, primero);
    const cita = await db.getRepository(Cita).findOneByOrFail({});
    await cal.cambiarEstado(ana, cita.id, 'no_asistio');
    expect(
      (await db.getRepository(Lead).findOneByOrFail({ id: lead.id })).etapa,
    ).toBe('no_asistio');
  });

  it('cancelar libera el horario', async () => {
    const c = await cal.crearCita(gerente, {
      miembroId: ana.id,
      inicio: '2026-11-09T14:00:00.000Z',
      titulo: 'A',
    });
    await cal.cambiarEstado(gerente, c.id, 'cancelada');
    await expect(
      cal.crearCita(gerente, {
        miembroId: ana.id,
        inicio: '2026-11-09T14:00:00.000Z',
        titulo: 'B',
      }),
    ).resolves.toBeTruthy();
  });
});
