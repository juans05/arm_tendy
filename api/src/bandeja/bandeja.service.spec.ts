import {
  BadGatewayException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { limpiarBase } from '../../test/util/app';
import { crearDbTest } from '../../test/util/db';
import { crearNumero, payloadTexto } from '../../test/util/whatsapp';
import { MediaWhatsappService } from '../canales/media-whatsapp.service';
import { EnvioWhatsappService } from '../canales/envio-whatsapp.service';
import { MetaError, MetaGraph } from '../canales/meta-graph.client';
import { Miembro } from '../miembros/miembro.entity';
import { BandejaService } from './bandeja.service';
import { Conversacion } from './conversacion.entity';
import { EntrantesService } from './entrantes.service';
import { EventoBandeja, EventosService } from './eventos.service';
import { Mensaje } from './mensaje.entity';

const HORA = 3600_000;

describe('BandejaService', () => {
  let db: DataSource;
  let eventos: EventosService;
  let entrantes: EntrantesService;
  let llamadas: { metodo: string; ruta: string; opts: any }[];
  let falla: boolean;
  let svc: BandejaService;
  let emitidos: EventoBandeja[];
  const miembro = {
    id: '00000000-0000-0000-0000-000000000001',
    tenant: 'wuarikes',
  } as Miembro;

  beforeAll(async () => {
    db = await crearDbTest();
  });
  afterAll(() => db.destroy());
  beforeEach(async () => {
    await limpiarBase(db);
    llamadas = [];
    falla = false;
    emitidos = [];
    eventos = new EventosService();
    eventos.deEmpresa('wuarikes').subscribe((e) => emitidos.push(e));
    entrantes = new EntrantesService(db, eventos);
    const meta = {
      async llamar(metodo: string, ruta: string, opts: any) {
        llamadas.push({ metodo, ruta, opts });
        if (falla) throw new MetaError('número bloqueado');
        return { messages: [{ id: 'wamid.salida' }] };
      },
    } as unknown as MetaGraph;
    svc = new BandejaService(
      db,
      eventos,
      new EnvioWhatsappService(meta),
      new MediaWhatsappService(meta),
    );
  });

  const conversacion = async (
    tenant = 'wuarikes',
    ph = 'ph1',
    from = '51911',
    texto = 'Hola',
  ) => {
    if (
      !(
        await db.query(
          'SELECT 1 FROM numeros_whatsapp WHERE phone_number_id = $1',
          [ph],
        )
      ).length
    )
      await crearNumero(db, tenant, ph);
    await entrantes.procesar(
      payloadTexto(ph, `wamid.${ph}.${from}.${texto}`, texto, from),
    );
    return db
      .getRepository(Conversacion)
      .findOneByOrFail({ tenant, contacto: { telefono: from } });
  };

  it('listar ordena por último mensaje y no cruza empresas', async () => {
    const a = await conversacion('wuarikes', 'ph1', '51911', 'primero');
    const b = await conversacion('wuarikes', 'ph1', '51922', 'segundo');
    await conversacion('tendy', 'ph2', '51933', 'ajeno');
    await db.query(
      "UPDATE conversaciones SET ultimo_mensaje_en = now() - interval '1 hour' WHERE id = $1",
      [a.id],
    );

    const lista = await svc.listar('wuarikes');
    expect(lista.map((c) => c.id)).toEqual([b.id, a.id]);
    expect(lista[0]).toMatchObject({
      contacto: { telefono: '51922', nombre: 'Rosa' },
      modo: 'ia',
      noLeidos: 1,
      ultimoTexto: 'segundo',
    });
    expect(lista[0].ultimoEntranteEn).toBeTruthy();
  });

  it('ultimoTexto de un mensaje sin texto muestra el tipo', async () => {
    await crearNumero(db, 'wuarikes', 'ph1');
    await entrantes.procesar(
      payloadTexto('ph1', 'wamid.a', 'x', '51911', {
        type: 'audio',
        text: undefined,
        audio: { id: 'm1' },
      }),
    );
    expect((await svc.listar('wuarikes'))[0].ultimoTexto).toBe('[audio]');
  });

  it('mensajes pone noLeidos en 0', async () => {
    const c = await conversacion();
    const ms = await svc.mensajes('wuarikes', c.id);
    expect(ms.map((m) => m.texto)).toEqual(['Hola']);
    expect(
      (await db.getRepository(Conversacion).findOneByOrFail({ id: c.id }))
        .noLeidos,
    ).toBe(0);
  });

  it('responder dentro de 24 h envía, guarda y pasa a humano', async () => {
    const c = await conversacion();
    emitidos.length = 0;
    const m = await svc.responder(
      'wuarikes',
      c.id,
      miembro,
      'Hola Rosa, te ayudo',
    );

    expect(llamadas).toEqual([
      {
        metodo: 'POST',
        ruta: '/ph1/messages',
        opts: {
          token: 'tok',
          body: {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: '51911',
            type: 'text',
            text: { body: 'Hola Rosa, te ayudo', preview_url: false },
          },
        },
      },
    ]);
    expect(m).toMatchObject({
      direccion: 'saliente',
      origen: 'humano',
      texto: 'Hola Rosa, te ayudo',
      autorMiembroId: miembro.id,
      waMessageId: 'wamid.salida',
    });
    expect(
      (await db.getRepository(Conversacion).findOneByOrFail({ id: c.id })).modo,
    ).toBe('humano');
    expect(emitidos).toEqual([
      {
        tipo: 'mensaje',
        conversacionId: c.id,
        mensaje: expect.objectContaining({ id: m.id }),
      },
    ]);
  });

  it('responder fuera de la ventana → 409 FUERA_DE_VENTANA sin llamar a Meta', async () => {
    const c = await conversacion();
    await db
      .getRepository(Conversacion)
      .update(c.id, { ultimoEntranteEn: new Date(Date.now() - 25 * HORA) });
    const e = await svc
      .responder('wuarikes', c.id, miembro, 'hola')
      .catch((x) => x);
    expect(e).toBeInstanceOf(ConflictException);
    expect(e.getResponse()).toMatchObject({ code: 'FUERA_DE_VENTANA' });
    expect(llamadas).toEqual([]);
  });

  it('responder sin ningún entrante → 409 FUERA_DE_VENTANA', async () => {
    const c = await conversacion();
    await db
      .getRepository(Conversacion)
      .update(c.id, { ultimoEntranteEn: null });
    const e = await svc
      .responder('wuarikes', c.id, miembro, 'hola')
      .catch((x) => x);
    expect(e.getResponse()).toMatchObject({ code: 'FUERA_DE_VENTANA' });
  });

  it('falla de Meta → 502 sin guardar', async () => {
    const c = await conversacion();
    falla = true;
    await expect(
      svc.responder('wuarikes', c.id, miembro, 'hola'),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(
      await db.getRepository(Mensaje).countBy({ direccion: 'saliente' }),
    ).toBe(0);
    expect(
      (await db.getRepository(Conversacion).findOneByOrFail({ id: c.id })).modo,
    ).toBe('ia');
  });

  it('conversación de otra empresa → 404', async () => {
    const ajena = await conversacion('tendy', 'ph2', '51933');
    await expect(svc.mensajes('wuarikes', ajena.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      svc.responder('wuarikes', ajena.id, miembro, 'hola'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(llamadas).toEqual([]);
  });
});
