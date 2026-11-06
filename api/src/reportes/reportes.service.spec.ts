import * as XLSX from 'xlsx';
import { DataSource } from 'typeorm';
import { limpiarBase } from '../../test/util/app';
import { crearDbTest } from '../../test/util/db';
import { crearNumero, payloadTexto } from '../../test/util/whatsapp';
import { EntrantesService } from '../bandeja/entrantes.service';
import { EventosService } from '../bandeja/eventos.service';
import { Cita } from '../calendario/cita.entity';
import { LeadHistorial } from '../leads/lead-historial.entity';
import { Lead } from '../leads/lead.entity';
import { Miembro } from '../miembros/miembro.entity';
import { AnunciosService } from '../anuncios/anuncios.service';
import { ReportesService } from './reportes.service';

const DIA = 24 * 3600_000;

describe('ReportesService', () => {
  let db: DataSource;
  let entrantes: EntrantesService;
  let rep: ReportesService;
  let gerente: Miembro;
  let ana: Miembro;
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - 7 * DIA);

  beforeAll(async () => (db = await crearDbTest()));
  afterAll(() => db.destroy());

  beforeEach(async () => {
    await limpiarBase(db);
    entrantes = new EntrantesService(db, new EventosService());
    rep = new ReportesService(db);
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
  });

  let n = 0;
  const lead = async (
    cambios: Partial<Lead>,
    etapas: Lead['etapa'][] = [],
    hace = DIA,
  ) => {
    n++;
    const from = `5190${n}`;
    await entrantes.procesar(payloadTexto('ph1', `wamid.${n}`, 'Hola', from));
    const l = await db
      .getRepository(Lead)
      .findOneOrFail({ where: { contacto: { telefono: from } } });
    const creado = new Date(Date.now() - hace);
    await db
      .getRepository(Lead)
      .update(l.id, { ...cambios, createdAt: creado });
    let de: Lead['etapa'] = 'nuevo';
    for (const [i, a] of etapas.entries()) {
      await db.getRepository(LeadHistorial).save({
        tenant: 't',
        leadId: l.id,
        de,
        a,
        en: new Date(creado.getTime() + (i + 1) * 3600_000),
      });
      de = a;
    }
    if (etapas.length) await db.getRepository(Lead).update(l.id, { etapa: de });
    return l;
  };

  it('ventas, embudo, motivos y comparación con el período anterior', async () => {
    await lead(
      { calificado: true, monto: 1000, plan: 'Pro', duenoId: ana.id },
      ['en_conversacion', 'demo_agendada', 'demo_realizada', 'ganado'],
    );
    await lead({ calificado: true, motivo: 'precio' }, [
      'demo_agendada',
      'demo_realizada',
      'perdido',
    ]);
    await lead({ motivo: 'no aplica' }, ['descartado']);
    await lead({}, []);
    // Período anterior: una venta de 500.
    await lead({ monto: 500 }, ['ganado'], 10 * DIA);

    const k = await rep.kpis(gerente, { desde, hasta });
    expect(k.actual.ventas).toMatchObject({
      cantidad: 1,
      monto: 1000,
      ticket: 1000,
    });
    expect(k.anterior.ventas).toMatchObject({ cantidad: 1, monto: 500 });
    expect(k.actual.embudo).toEqual({
      leads: 4,
      calificados: 2,
      demoAgendada: 2,
      demoRealizada: 2,
      ganado: 1,
    });
    expect(k.actual.motivosPerdida).toEqual([{ motivo: 'precio', n: 1 }]);
    expect(k.actual.motivosDescarte).toEqual([{ motivo: 'no aplica', n: 1 }]);
    expect(k.actual.porComercial).toEqual([
      expect.objectContaining({ nombre: 'Ana', ganados: 1, monto: 1000 }),
    ]);
    expect(k.actual.tiempos.cicloHoras).toBeCloseTo(4, 0);
  });

  it('asistencia a demos y lo que viene', async () => {
    const l = await lead({}, ['demo_agendada']);
    const ahora = Date.now();
    const cita = (inicioMs: number, estado: Cita['estado']) =>
      db.getRepository(Cita).save({
        tenant: 't',
        leadId: l.id,
        miembroId: ana.id,
        inicio: new Date(ahora + inicioMs),
        fin: new Date(ahora + inicioMs + 1800_000),
        estado,
        titulo: 'Demo',
      });
    await cita(-2 * DIA, 'realizada');
    await cita(-DIA, 'no_asistio');
    await cita(2 * DIA, 'agendada');
    const k = await rep.kpis(gerente, { desde, hasta });
    expect(k.actual.asistencia).toMatchObject({ realizadas: 1, noAsistio: 1 });
    expect(k.proximo.demos).toBe(1);
  });

  it('un comercial no puede ver el panel', async () => {
    await expect(rep.kpis(ana, { desde, hasta })).rejects.toThrow();
  });

  it('exporta los leads del período a Excel', async () => {
    await lead({ monto: 1000, plan: 'Pro', duenoId: ana.id }, ['ganado']);
    const buf = await rep.excel(gerente, { desde, hasta });
    const hoja = XLSX.read(buf).Sheets.Leads;
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja);
    expect(filas).toEqual([
      expect.objectContaining({
        Etapa: 'ganado',
        Monto: 1000,
        Plan: 'Pro',
        Comercial: 'Ana',
      }),
    ]);
  });

  it('incluye el gasto de Meta Ads del período cuando hay cuenta conectada', async () => {
    const pedidos: unknown[][] = [];
    const anuncios = {
      resumen: async (...a: unknown[]) => {
        pedidos.push(a);
        return { gasto: 300, costoPorLead: 100 };
      },
    } as unknown as AnunciosService;
    const r = await new ReportesService(db, anuncios).kpis(gerente, {
      desde,
      hasta,
    });
    expect(r.anuncios).toEqual({ gasto: 300, costoPorLead: 100 });
    expect(pedidos).toEqual([['t', desde, hasta, 'America/Lima']]);
  });
});
