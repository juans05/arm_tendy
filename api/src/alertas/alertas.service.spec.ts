import { DataSource } from 'typeorm';
import { limpiarBase } from '../../test/util/app';
import { crearDbTest } from '../../test/util/db';
import { crearNumero } from '../../test/util/whatsapp';
import { EmpresaConfig } from '../agente/empresa-config.entity';
import { EventoBandeja, EventosService } from '../bandeja/eventos.service';
import { EnvioWhatsappService } from '../canales/envio-whatsapp.service';
import { Miembro } from '../miembros/miembro.entity';
import { Alerta } from './alerta.entity';
import { AlertasService } from './alertas.service';

describe('AlertasService', () => {
  let db: DataSource;
  let emitidos: EventoBandeja[];
  let plantillas: { a: string; nombre: string; params: string[] }[];
  let falla: boolean;
  let alertas: AlertasService;
  let ana: Miembro;
  let beto: Miembro;

  beforeAll(async () => (db = await crearDbTest()));
  afterAll(() => db.destroy());

  beforeEach(async () => {
    await limpiarBase(db);
    const eventos = new EventosService();
    emitidos = [];
    eventos.todos().subscribe((e) => emitidos.push(e.evento));
    plantillas = [];
    falla = false;
    const envio = {
      enviarPlantilla: async (
        _n: unknown,
        a: string,
        nombre: string,
        _idioma: string,
        params: string[],
      ) => {
        if (falla) throw new Error('Meta caído');
        plantillas.push({ a, nombre, params });
        return 'wamid.p';
      },
    } as unknown as EnvioWhatsappService;
    alertas = new AlertasService(db, eventos, envio);
    const repo = db.getRepository(Miembro);
    ana = await repo.save({
      tenant: 't',
      userId: '1',
      username: 'ana',
      nombre: 'Ana',
      rol: 'gerente',
      estado: 'activo',
      celularAlertas: '51999',
    });
    beto = await repo.save({
      tenant: 't',
      userId: '2',
      username: 'beto',
      nombre: 'Beto',
      rol: 'comercial',
      estado: 'activo',
      alertasOff: ['pregunta'],
    });
  });

  it('guarda la alerta, la emite con su destinatario y respeta las alertas apagadas', async () => {
    await alertas.avisar('t', [ana.id, beto.id], {
      tipo: 'pregunta',
      titulo: 'La IA no supo algo',
    });
    const guardadas = await db.getRepository(Alerta).find();
    expect(guardadas.map((a) => a.miembroId)).toEqual([ana.id]);
    expect(emitidos).toEqual([
      expect.objectContaining({ tipo: 'alerta', miembroId: ana.id }),
    ]);
  });

  it('con plantilla de alerta configurada también avisa por WhatsApp', async () => {
    await crearNumero(db, 't', 'ph1');
    await db
      .getRepository(EmpresaConfig)
      .save({ tenant: 't', plantillaAlerta: 'aviso_arm' });
    await alertas.avisar('t', [ana.id], {
      tipo: 'demo_agendada',
      titulo: 'Demo con Rosa',
      detalle: 'mañana 10:00',
    });
    expect(plantillas).toEqual([
      {
        a: '51999',
        nombre: 'aviso_arm',
        params: ['Demo con Rosa', 'mañana 10:00'],
      },
    ]);
  });

  it('un fallo de WhatsApp no impide la alerta en ARM', async () => {
    await crearNumero(db, 't', 'ph1');
    await db
      .getRepository(EmpresaConfig)
      .save({ tenant: 't', plantillaAlerta: 'aviso_arm' });
    falla = true;
    await alertas.avisar('t', [ana.id], { tipo: 'demo_agendada', titulo: 'x' });
    expect(await db.getRepository(Alerta).count()).toBe(1);
  });

  it('gerentes devuelve los gerentes activos', async () => {
    expect(await alertas.gerentes('t')).toEqual([ana.id]);
  });

  it('listar y marcar leídas solo tocan las alertas del miembro', async () => {
    await alertas.avisar('t', [ana.id], { tipo: 'demo_agendada', titulo: 'a' });
    await alertas.avisar('t', [beto.id], {
      tipo: 'demo_agendada',
      titulo: 'b',
    });
    await alertas.marcarLeidas(ana);
    expect((await alertas.listar(ana)).map((a) => [a.titulo, a.leida])).toEqual(
      [['a', true]],
    );
    expect((await alertas.listar(beto))[0].leida).toBe(false);
  });
});
