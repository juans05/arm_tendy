import { DataSource } from 'typeorm';
import { limpiarBase } from '../../test/util/app';
import { crearDbTest } from '../../test/util/db';
import { crearNumero, payloadTexto } from '../../test/util/whatsapp';
import { Conversacion } from '../bandeja/conversacion.entity';
import { EntrantesService } from '../bandeja/entrantes.service';
import { EventosService } from '../bandeja/eventos.service';
import { Mensaje } from '../bandeja/mensaje.entity';
import { EnvioWhatsappService } from '../canales/envio-whatsapp.service';
import { MetaGraph } from '../canales/meta-graph.client';
import { Lead } from '../leads/lead.entity';
import { Miembro } from '../miembros/miembro.entity';
import { PlantillasService } from './plantillas.service';

describe('PlantillasService', () => {
  let db: DataSource;
  let llamadas: { metodo: string; ruta: string; opts: any }[];
  let svc: PlantillasService;
  let ana: Miembro;

  beforeAll(async () => (db = await crearDbTest()));
  afterAll(() => db.destroy());

  beforeEach(async () => {
    await limpiarBase(db);
    llamadas = [];
    const meta = {
      async llamar(metodo: string, ruta: string, opts: any) {
        llamadas.push({ metodo, ruta, opts });
        if (metodo === 'GET')
          return {
            data: [
              {
                name: 'retomamos',
                language: 'es',
                status: 'APPROVED',
                category: 'MARKETING',
                components: [{ type: 'BODY', text: 'Hola {{1}}, ¿retomamos?' }],
              },
            ],
          };
        return { messages: [{ id: 'wamid.pl' }] };
      },
    } as unknown as MetaGraph;
    const eventos = new EventosService();
    svc = new PlantillasService(
      db,
      meta,
      new EnvioWhatsappService(meta),
      eventos,
    );
    await crearNumero(db, 't', 'ph1');
    await new EntrantesService(db, eventos).procesar(payloadTexto('ph1', 'w1'));
    ana = await db.getRepository(Miembro).save({
      tenant: 't',
      userId: 'a',
      username: 'ana',
      nombre: 'Ana',
      rol: 'comercial',
      estado: 'activo',
    });
  });

  it('lista las plantillas aprobadas con su texto y número de variables', async () => {
    const r = await svc.listar('t');
    expect(llamadas[0]).toMatchObject({
      metodo: 'GET',
      ruta: '/w-ph1/message_templates',
    });
    expect(r).toEqual([
      {
        nombre: 'retomamos',
        idioma: 'es',
        categoria: 'MARKETING',
        texto: 'Hola {{1}}, ¿retomamos?',
        variables: 1,
      },
    ]);
  });

  it('envía la plantilla con sus variables, guarda el mensaje y el comercial se queda con el lead', async () => {
    const conv = await db.getRepository(Conversacion).findOneByOrFail({});
    await db.getRepository(Conversacion).update(conv.id, { alertaNivel: 1 });
    const m = await svc.enviar(ana, conv.id, 'retomamos', 'es', ['Rosa']);
    expect(m).toMatchObject({
      origen: 'humano',
      tipo: 'template',
      texto: 'Hola Rosa, ¿retomamos?',
    });
    expect(llamadas.at(-1)?.opts.body.template).toMatchObject({
      name: 'retomamos',
      components: [
        { type: 'body', parameters: [{ type: 'text', text: 'Rosa' }] },
      ],
    });
    expect(await db.getRepository(Mensaje).countBy({ tipo: 'template' })).toBe(
      1,
    );
    expect((await db.getRepository(Lead).findOneByOrFail({})).duenoId).toBe(
      ana.id,
    );
    expect(
      (await db.getRepository(Conversacion).findOneByOrFail({ id: conv.id }))
        .alertaNivel,
    ).toBe(0);
  });

  it('no envía si faltan variables', async () => {
    const conv = await db.getRepository(Conversacion).findOneByOrFail({});
    await expect(
      svc.enviar(ana, conv.id, 'retomamos', 'es', []),
    ).rejects.toThrow('variables');
  });

  it('no escribe a quien pidió no ser contactado', async () => {
    const conv = await db.getRepository(Conversacion).findOneByOrFail({});
    await db.query('UPDATE contactos SET no_contactar = true');
    await expect(
      svc.enviar(ana, conv.id, 'retomamos', 'es', ['Rosa']),
    ).rejects.toThrow('no ser contactado');
  });
});
