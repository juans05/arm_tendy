import { DataSource } from 'typeorm';
import { limpiarBase } from '../../test/util/app';
import { crearDbTest } from '../../test/util/db';
import { crearNumero, payloadTexto } from '../../test/util/whatsapp';
import { AlertasService } from '../alertas/alertas.service';
import { Contacto } from '../bandeja/contacto.entity';
import { Conversacion } from '../bandeja/conversacion.entity';
import { EntrantesService } from '../bandeja/entrantes.service';
import { EventosService } from '../bandeja/eventos.service';
import { Miembro } from '../miembros/miembro.entity';
import { Lead } from './lead.entity';
import { LeadsService } from './leads.service';

describe('LeadsService.tabla', () => {
  let db: DataSource;
  let entrantes: EntrantesService;
  let leads: LeadsService;
  let gerente: Miembro;
  let ana: Miembro;

  beforeAll(async () => (db = await crearDbTest()));
  afterAll(() => db.destroy());

  beforeEach(async () => {
    await limpiarBase(db);
    const eventos = new EventosService();
    entrantes = new EntrantesService(db, eventos);
    leads = new LeadsService(db, eventos, {} as AlertasService);
    await crearNumero(db, 't', 'ph1');
    const m = (username: string, rol: 'gerente' | 'comercial') =>
      db.getRepository(Miembro).save({
        tenant: 't',
        userId: username,
        username,
        nombre: username,
        rol,
        estado: 'activo',
      });
    gerente = await m('gere', 'gerente');
    ana = await m('ana', 'comercial');
  });

  const lead = async (from: string, nombre: string, extra: Partial<Lead>) => {
    await entrantes.procesar(
      payloadTexto('ph1', 'wamid.' + from, 'Hola', from),
    );
    const conv = await db.getRepository(Conversacion).findOneOrFail({
      where: { contacto: { telefono: from } },
    });
    await db.getRepository(Contacto).update(conv.contactoId, { nombre });
    const l = await db
      .getRepository(Lead)
      .findOneByOrFail({ conversacionId: conv.id });
    if (Object.keys(extra).length)
      await db.getRepository(Lead).update(l.id, extra);
    return l.id;
  };

  it('busca por nombre, teléfono o dato extraído, sin importar mayúsculas', async () => {
    await lead('51900000001', 'Bodega Rosita', {});
    await lead('51900000002', 'Juan Pérez', {
      datos: { ruc: { valor: '20601234567', evidencia: 'mi ruc es…' } },
    });
    await lead('51988877766', 'Ferretería Sol', {});
    const nombres = async (q: string) =>
      (await leads.tabla(gerente, { q })).items.map((l) => l.contacto!.nombre);
    expect(await nombres('rosita')).toEqual(['Bodega Rosita']);
    expect(await nombres('2060123')).toEqual(['Juan Pérez']);
    expect(await nombres('988877')).toEqual(['Ferretería Sol']);
    // "ruc" es la clave del dato, no un valor: no trae a nadie.
    expect(await nombres('ruc')).toEqual([]);
    // Los comodines de LIKE se buscan literales.
    expect(await nombres('%')).toEqual([]);
  });

  it('filtra por varias etapas, sin dueño y calificados; ordena y pagina con total', async () => {
    await lead('51901', 'A', { etapa: 'nuevo', puntaje: 10 });
    await lead('51902', 'B', {
      etapa: 'demo_agendada',
      puntaje: 80,
      calificado: true,
    });
    await lead('51903', 'C', {
      etapa: 'ganado',
      puntaje: 50,
      duenoId: ana.id,
      monto: 900,
    });
    await lead('51904', 'D', {
      etapa: 'demo_agendada',
      puntaje: 30,
      duenoId: ana.id,
    });

    const r = await leads.tabla(gerente, {
      etapas: ['demo_agendada', 'ganado'],
      orden: 'puntaje',
      porPagina: 2,
      pagina: 1,
    });
    expect(r.total).toBe(3);
    expect(r.items.map((l) => l.contacto!.nombre)).toEqual(['B', 'C']);
    const p2 = await leads.tabla(gerente, {
      etapas: ['demo_agendada', 'ganado'],
      orden: 'puntaje',
      porPagina: 2,
      pagina: 2,
    });
    expect(p2.items.map((l) => l.contacto!.nombre)).toEqual(['D']);

    const nombres = async (f: Parameters<LeadsService['tabla']>[1]) =>
      (await leads.tabla(gerente, f)).items
        .map((l) => l.contacto!.nombre)
        .sort();
    expect(await nombres({ duenoId: 'sin' })).toEqual(['A', 'B']);
    expect(await nombres({ duenoId: ana.id })).toEqual(['C', 'D']);
    expect(await nombres({ calificado: true })).toEqual(['B']);
    expect(
      (await leads.tabla(gerente, { orden: 'monto' })).items[0].contacto!
        .nombre,
    ).toBe('C');
  });

  it('el comercial solo ve los suyos y los sin dueño', async () => {
    const gere = await db
      .getRepository(Miembro)
      .findOneByOrFail({ id: gerente.id });
    await lead('51901', 'Libre', {});
    await lead('51902', 'De Ana', { duenoId: ana.id });
    await lead('51903', 'Del gerente', { duenoId: gere.id });
    const r = await leads.tabla(ana, {});
    expect(r.total).toBe(2);
    expect(r.items.map((l) => l.contacto!.nombre).sort()).toEqual([
      'De Ana',
      'Libre',
    ]);
  });
});
