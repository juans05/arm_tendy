import { DataSource } from 'typeorm';
import { limpiarBase } from '../../test/util/app';
import { crearDbTest } from '../../test/util/db';
import { crearNumero, payloadTexto } from '../../test/util/whatsapp';
import { NumeroWhatsapp } from '../canales/numero-whatsapp.entity';
import { Contacto } from './contacto.entity';
import { Conversacion } from './conversacion.entity';
import { EntrantesService } from './entrantes.service';
import { EventoBandeja, EventosService } from './eventos.service';
import { Mensaje } from './mensaje.entity';
import { Lead } from '../leads/lead.entity';

describe('EntrantesService', () => {
  let db: DataSource;
  let eventos: EventosService;
  let svc: EntrantesService;
  let emitidos: { tenant: string; ev: EventoBandeja }[];

  beforeAll(async () => {
    db = await crearDbTest();
  });
  afterAll(() => db.destroy());
  beforeEach(async () => {
    await limpiarBase(db);
    eventos = new EventosService();
    emitidos = [];
    const original = eventos.emitir.bind(eventos);
    eventos.emitir = (tenant, ev) => {
      emitidos.push({ tenant, ev });
      original(tenant, ev);
    };
    svc = new EntrantesService(db, eventos);
  });

  it('crea contacto, conversación y mensaje y emite evento', async () => {
    await crearNumero(db, 'wuarikes', 'ph1');
    await svc.procesar(payloadTexto('ph1', 'wamid.1', 'Hola, info'));

    const [contacto] = await db.getRepository(Contacto).find();
    expect(contacto).toMatchObject({
      tenant: 'wuarikes',
      telefono: '51911',
      nombre: 'Rosa',
    });
    const [conv] = await db.getRepository(Conversacion).find();
    expect(conv).toMatchObject({
      tenant: 'wuarikes',
      contactoId: contacto.id,
      modo: 'ia',
      noLeidos: 1,
    });
    expect(conv.ultimoEntranteEn).toBeInstanceOf(Date);
    const [m] = await db.getRepository(Mensaje).find();
    expect(m).toMatchObject({
      tenant: 'wuarikes',
      conversacionId: conv.id,
      direccion: 'entrante',
      origen: 'cliente',
      tipo: 'text',
      texto: 'Hola, info',
      waMessageId: 'wamid.1',
    });
    expect(emitidos).toEqual([
      {
        tenant: 'wuarikes',
        ev: {
          tipo: 'mensaje',
          conversacionId: conv.id,
          mensaje: expect.objectContaining({ id: m.id }),
        },
      },
    ]);
  });

  it('un mensaje que falla no descarta los demás del lote y el error sube (Meta reintenta)', async () => {
    await crearNumero(db, 'wuarikes', 'ph1');
    const malo = payloadTexto('ph1', 'wamid.malo', 'x', '9'.repeat(40));
    const bueno = payloadTexto('ph1', 'wamid.ok', 'y');
    malo.entry.push(...bueno.entry);

    await expect(svc.procesar(malo)).rejects.toThrow();
    const ids = (await db.getRepository(Mensaje).find()).map(
      (m) => m.waMessageId,
    );
    expect(ids).toEqual(['wamid.ok']);
  });

  it('mensaje duplicado se guarda una vez', async () => {
    await crearNumero(db, 'wuarikes', 'ph1');
    await svc.procesar(payloadTexto('ph1', 'wamid.1'));
    await svc.procesar(payloadTexto('ph1', 'wamid.1'));
    expect(await db.getRepository(Mensaje).count()).toBe(1);
    expect(emitidos).toHaveLength(1);
    expect(
      (await db.getRepository(Conversacion).findOneByOrFail({})).noLeidos,
    ).toBe(1);
  });

  it('el mismo payload en paralelo también se guarda una vez', async () => {
    await crearNumero(db, 'wuarikes', 'ph1');
    await Promise.all([
      svc.procesar(payloadTexto('ph1', 'wamid.1')),
      svc.procesar(payloadTexto('ph1', 'wamid.1')),
    ]);
    expect(await db.getRepository(Mensaje).count()).toBe(1);
    expect(await db.getRepository(Conversacion).count()).toBe(1);
    expect(emitidos).toHaveLength(1);
  });

  it('número desconocido se ignora', async () => {
    await svc.procesar(payloadTexto('ph-x', 'wamid.1'));
    expect(await db.getRepository(Mensaje).count()).toBe(0);
    expect(await db.getRepository(Contacto).count()).toBe(0);
    expect(emitidos).toHaveLength(0);
  });

  it('número inactivo se ignora', async () => {
    const n = await crearNumero(db, 'wuarikes', 'ph1');
    await db.getRepository(NumeroWhatsapp).update(n.id, { activo: false });
    await svc.procesar(payloadTexto('ph1', 'wamid.1'));
    expect(await db.getRepository(Mensaje).count()).toBe(0);
  });

  it('dos números de empresas distintas no se mezclan', async () => {
    await crearNumero(db, 'wuarikes', 'ph1');
    await crearNumero(db, 'tendy', 'ph2');
    await svc.procesar(payloadTexto('ph1', 'wamid.1', 'para wuarikes'));
    await svc.procesar(payloadTexto('ph2', 'wamid.2', 'para tendy'));
    const contactos = await db
      .getRepository(Contacto)
      .find({ order: { tenant: 'ASC' } });
    expect(contactos.map((c) => c.tenant)).toEqual(['tendy', 'wuarikes']);
    const ms = await db
      .getRepository(Mensaje)
      .find({ order: { texto: 'ASC' } });
    expect(ms.map((m) => [m.tenant, m.texto])).toEqual([
      ['tendy', 'para tendy'],
      ['wuarikes', 'para wuarikes'],
    ]);
    expect(emitidos.map((e) => e.tenant).sort()).toEqual(['tendy', 'wuarikes']);
  });

  it('eco pasa la conversación a humano', async () => {
    await crearNumero(db, 'wuarikes', 'ph1');
    await svc.procesar(payloadTexto('ph1', 'wamid.1'));
    await svc.procesar({
      entry: [
        {
          changes: [
            {
              field: 'smb_message_echoes',
              value: {
                metadata: { phone_number_id: 'ph1' },
                message_echoes: [
                  {
                    id: 'wamid.e1',
                    to: '51911',
                    type: 'text',
                    text: { body: 'Te llamo' },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    const conv = await db.getRepository(Conversacion).findOneByOrFail({});
    expect(conv.modo).toBe('humano');
    expect(conv.noLeidos).toBe(1);
    const eco = await db
      .getRepository(Mensaje)
      .findOneByOrFail({ waMessageId: 'wamid.e1' });
    expect(eco).toMatchObject({
      direccion: 'saliente',
      origen: 'app_celular',
      texto: 'Te llamo',
      conversacionId: conv.id,
    });
    expect(emitidos).toHaveLength(2);
  });

  it('guarda el referral del anuncio', async () => {
    await crearNumero(db, 'wuarikes', 'ph1');
    await svc.procesar(
      payloadTexto('ph1', 'wamid.1', 'Hola', '51911', {
        referral: {
          source_id: 'ad1',
          source_type: 'ad',
          source_url: 'u',
          headline: 'h',
        },
      }),
    );
    const m = await db.getRepository(Mensaje).findOneByOrFail({});
    expect(m.referral).toEqual({
      sourceId: 'ad1',
      sourceType: 'ad',
      sourceUrl: 'u',
      headline: 'h',
    });
  });

  it('el mensaje del cliente crea un lead con el anuncio que lo trajo; el eco no', async () => {
    await crearNumero(db, 'wuarikes', 'ph1');
    await svc.procesar(
      payloadTexto('ph1', 'wamid.1', 'Hola', '51911', {
        referral: {
          source_id: 'ad1',
          source_type: 'ad',
          source_url: 'u',
          headline: 'h',
        },
      }),
    );
    await svc.procesar(payloadTexto('ph1', 'wamid.2', 'Sigo aquí'));
    const leads = await db.getRepository(Lead).find();
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      tenant: 'wuarikes',
      etapa: 'nuevo',
      referral: { sourceId: 'ad1' },
    });
  });
});
