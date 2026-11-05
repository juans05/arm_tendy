import { DataSource } from 'typeorm';
import { limpiarBase } from '../../test/util/app';
import { crearDbTest } from '../../test/util/db';
import { crearNumero, payloadTexto } from '../../test/util/whatsapp';
import { EmpresaConfig } from '../agente/empresa-config.entity';
import { Alerta } from '../alertas/alerta.entity';
import { AlertasService } from '../alertas/alertas.service';
import { Contacto } from '../bandeja/contacto.entity';
import { Conversacion } from '../bandeja/conversacion.entity';
import { EntrantesService } from '../bandeja/entrantes.service';
import { EventosService } from '../bandeja/eventos.service';
import { Mensaje } from '../bandeja/mensaje.entity';
import { Cita } from '../calendario/cita.entity';
import { EnvioWhatsappService } from '../canales/envio-whatsapp.service';
import { Lead } from '../leads/lead.entity';
import { LeadsService } from '../leads/leads.service';
import { Miembro } from '../miembros/miembro.entity';
import { SeguimientoService } from './seguimiento.service';

const H = 3600_000;
const DIA = 24 * H;

describe('SeguimientoService', () => {
  let db: DataSource;
  let entrantes: EntrantesService;
  let enviados: { tipo: 'texto' | 'plantilla'; a: string; valor: string }[];
  let seg: SeguimientoService;
  let gerente: Miembro;
  let ana: Miembro;

  beforeAll(async () => (db = await crearDbTest()));
  afterAll(() => db.destroy());

  beforeEach(async () => {
    await limpiarBase(db);
    const eventos = new EventosService();
    entrantes = new EntrantesService(db, eventos);
    enviados = [];
    const envio = {
      enviarTexto: async (_n: unknown, a: string, valor: string) => {
        enviados.push({ tipo: 'texto', a, valor });
        return `wamid.t${enviados.length}`;
      },
      enviarPlantilla: async (_n: unknown, a: string, valor: string) => {
        enviados.push({ tipo: 'plantilla', a, valor });
        return `wamid.p${enviados.length}`;
      },
    } as unknown as EnvioWhatsappService;
    const alertas = new AlertasService(db, eventos, envio);
    const leads = new LeadsService(db, eventos, alertas);
    seg = new SeguimientoService(db, envio, alertas, eventos);
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
    });
    void leads;
  });

  const nuevoLead = async (from = '51911') => {
    await entrantes.procesar(
      payloadTexto('ph1', 'wamid.' + from, 'Hola', from),
    );
    const conv = await db.getRepository(Conversacion).findOneOrFail({
      where: { contacto: { telefono: from } },
    });
    const lead = await db
      .getRepository(Lead)
      .findOneByOrFail({ conversacionId: conv.id });
    return { conv, lead };
  };
  const leadDe = (id: string) => db.getRepository(Lead).findOneByOrFail({ id });
  const alertasDe = (m: Miembro) =>
    db.getRepository(Alerta).findBy({ miembroId: m.id });

  describe('seguimiento de los que dijeron "todavía no"', () => {
    it('escribe con la plantilla a los N y M días y luego archiva', async () => {
      await db
        .getRepository(EmpresaConfig)
        .save({ tenant: 't', plantillaSeguimiento: 'retomamos' });
      const { lead } = await nuevoLead();
      const t0 = new Date();
      await db
        .getRepository(Lead)
        .update(lead.id, { etapa: 'seguimiento', etapaEn: t0 });

      await seg.barrer(new Date(t0.getTime() + 1 * DIA));
      expect(enviados).toEqual([]);
      await seg.barrer(new Date(t0.getTime() + 3 * DIA + H));
      expect(enviados).toEqual([
        { tipo: 'plantilla', a: '51911', valor: 'retomamos' },
      ]);
      await seg.barrer(new Date(t0.getTime() + 4 * DIA));
      expect(enviados).toHaveLength(1);
      await seg.barrer(new Date(t0.getTime() + 7 * DIA + 2 * H));
      expect(enviados).toHaveLength(2);
      expect((await leadDe(lead.id)).etapa).toBe('seguimiento');
      await seg.barrer(new Date(t0.getTime() + 14 * DIA + 3 * H));
      expect((await leadDe(lead.id)).etapa).toBe('archivado');
      expect(enviados).toHaveLength(2);
    });

    it('sin plantilla configurada avisa al dueño para que escriba él', async () => {
      const { lead } = await nuevoLead();
      const t0 = new Date();
      await db.getRepository(Lead).update(lead.id, {
        etapa: 'seguimiento',
        etapaEn: t0,
        duenoId: ana.id,
      });
      await seg.barrer(new Date(t0.getTime() + 3 * DIA + H));
      expect(enviados).toEqual([]);
      expect((await alertasDe(ana)).map((a) => a.tipo)).toEqual([
        'seguimiento',
      ]);
    });

    it('si el cliente vuelve a escribir, el seguimiento se corta y vuelve a conversación', async () => {
      const { conv, lead } = await nuevoLead();
      await db.getRepository(Lead).update(lead.id, {
        etapa: 'seguimiento',
        seguimientoPaso: 1,
        seguimientoProximo: new Date(),
      });
      await seg.clienteRespondio(conv.id);
      expect(await leadDe(lead.id)).toMatchObject({
        etapa: 'en_conversacion',
        seguimientoPaso: 0,
        seguimientoProximo: null,
      });
    });

    it('a quien pidió no ser contactado no se le escribe', async () => {
      await db
        .getRepository(EmpresaConfig)
        .save({ tenant: 't', plantillaSeguimiento: 'retomamos' });
      const { conv, lead } = await nuevoLead();
      await seg.pedirBaja(conv);
      expect(await leadDe(lead.id)).toMatchObject({ etapa: 'descartado' });
      expect(
        (
          await db
            .getRepository(Contacto)
            .findOneByOrFail({ id: conv.contactoId })
        ).noContactar,
      ).toBe(true);
      await db
        .getRepository(Lead)
        .update(lead.id, { etapa: 'seguimiento', etapaEn: new Date() });
      await seg.barrer(new Date(Date.now() + 3 * DIA + H));
      expect(enviados).toEqual([]);
    });
  });

  describe('leads sin atender', () => {
    it('avisa al dueño y, si sigue sin respuesta, al gerente', async () => {
      const { conv, lead } = await nuevoLead();
      await db.getRepository(Conversacion).update(conv.id, { modo: 'humano' });
      await db.getRepository(Lead).update(lead.id, { duenoId: ana.id });
      const llego = new Date();
      await seg.barrer(new Date(llego.getTime() + 5 * 60_000));
      expect(await alertasDe(ana)).toHaveLength(0);
      await seg.barrer(new Date(llego.getTime() + 16 * 60_000));
      expect((await alertasDe(ana)).map((a) => a.tipo)).toEqual([
        'sin_atender',
      ]);
      await seg.barrer(new Date(llego.getTime() + 20 * 60_000));
      expect(await alertasDe(ana)).toHaveLength(1);
      await seg.barrer(new Date(llego.getTime() + 31 * 60_000));
      expect(
        (await alertasDe(gerente)).filter((a) => a.tipo === 'sin_atender'),
      ).toHaveLength(1);
    });

    it('en modo IA no avisa: la IA atiende', async () => {
      await nuevoLead();
      await seg.barrer(new Date(Date.now() + 60 * 60_000));
      expect(
        await db.getRepository(Alerta).countBy({ tipo: 'sin_atender' }),
      ).toBe(0);
    });
  });

  describe('recordatorios de demo', () => {
    const conCita = async (enMs: number, creadaHaceMs = 3 * DIA) => {
      const { conv, lead } = await nuevoLead();
      const ahora = new Date();
      await db.getRepository(Cita).save({
        tenant: 't',
        leadId: lead.id,
        miembroId: ana.id,
        inicio: new Date(ahora.getTime() + enMs),
        fin: new Date(ahora.getTime() + enMs + 30 * 60_000),
        titulo: 'Demo',
        createdAt: new Date(ahora.getTime() - creadaHaceMs),
      });
      return { conv, ahora };
    };

    it('recuerda al cliente 24 h y 2 h antes (texto si la ventana está abierta) y avisa al comercial 30 min antes', async () => {
      const { ahora } = await conCita(23 * H);
      await seg.barrer(ahora);
      expect(enviados.map((e) => e.tipo)).toEqual(['texto']);
      expect(enviados[0].valor).toMatch(/recordatorio/i);
      await seg.barrer(ahora);
      expect(enviados).toHaveLength(1);
      await seg.barrer(new Date(ahora.getTime() + 21 * H + 10 * 60_000));
      expect(enviados).toHaveLength(2);
      await seg.barrer(new Date(ahora.getTime() + 22 * H + 40 * 60_000));
      expect((await alertasDe(ana)).map((a) => a.tipo)).toEqual([
        'demo_pronto',
      ]);
      expect(
        await db.getRepository(Mensaje).countBy({ origen: 'sistema' }),
      ).toBe(2);
    });

    it('fuera de la ventana de 24 h usa la plantilla de recordatorio', async () => {
      await db
        .getRepository(EmpresaConfig)
        .save({ tenant: 't', plantillaRecordatorio: 'tu_demo' });
      const { conv, ahora } = await conCita(23 * H);
      await db.getRepository(Conversacion).update(conv.id, {
        ultimoEntranteEn: new Date(ahora.getTime() - 2 * DIA),
      });
      await seg.barrer(ahora);
      expect(enviados).toEqual([
        { tipo: 'plantilla', a: '51911', valor: 'tu_demo' },
      ]);
    });

    it('una cita agendada hace poco no recibe el recordatorio de 24 h', async () => {
      const { ahora } = await conCita(20 * H, H);
      await seg.barrer(ahora);
      expect(enviados).toEqual([]);
    });
  });

  describe('resumen diario', () => {
    it('a las 8:00 hora de la empresa avisa a los gerentes una sola vez al día', async () => {
      await nuevoLead();
      await seg.barrer(new Date('2026-11-09T07:30:00-05:00'));
      expect(await alertasDe(gerente)).toHaveLength(0);
      await seg.barrer(new Date('2026-11-09T08:01:00-05:00'));
      await seg.barrer(new Date('2026-11-09T09:00:00-05:00'));
      const r = await alertasDe(gerente);
      expect(r.map((a) => a.tipo)).toEqual(['resumen_diario']);
      expect(await alertasDe(ana)).toHaveLength(0);
    });
  });
});
