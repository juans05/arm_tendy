import { DataSource } from 'typeorm';
import { limpiarBase } from '../../test/util/app';
import { crearDbTest } from '../../test/util/db';
import { crearNumero, payloadTexto } from '../../test/util/whatsapp';
import { Conversacion } from '../bandeja/conversacion.entity';
import { EntrantesService } from '../bandeja/entrantes.service';
import { EventoBandeja, EventosService } from '../bandeja/eventos.service';
import { Mensaje } from '../bandeja/mensaje.entity';
import { EnvioWhatsappService } from '../canales/envio-whatsapp.service';
import { MediaWhatsappService } from '../canales/media-whatsapp.service';
import { ConocimientoService } from '../conocimiento/conocimiento.service';
import { Pregunta } from '../conocimiento/pregunta.entity';
import { EjecucionIa } from '../ia/ejecucion-ia.entity';
import { IaService } from '../ia/ia.service';
import { Lead } from '../leads/lead.entity';
import { LineaProducto } from '../lineas/linea-producto.entity';
import { AgenteService } from './agente.service';
import { EmpresaConfig } from './empresa-config.entity';

const decision = (o: object = {}) =>
  JSON.stringify({
    respuesta: '¡Hola Rosa! ¿Tu barbería ya está funcionando?',
    linea: 'barbería',
    datos: { cargo: { valor: 'dueña', evidencia: 'soy la dueña' } },
    sugerencias: [],
    puntaje: 55,
    calificado: false,
    etapa: 'en_conversacion',
    motivo_descarte: null,
    traspaso: null,
    pregunta_sin_respuesta: null,
    ...o,
  });

describe('AgenteService', () => {
  let db: DataSource;
  let eventos: EventosService;
  let entrantes: EntrantesService;
  let enviados: string[];
  let emitidos: EventoBandeja[];
  let respuestaIa: () => Promise<string>;
  let agente: AgenteService;

  beforeAll(async () => (db = await crearDbTest()));
  afterAll(() => db.destroy());

  beforeEach(async () => {
    await limpiarBase(db);
    eventos = new EventosService();
    emitidos = [];
    eventos.todos().subscribe((e) => emitidos.push(e.evento));
    entrantes = new EntrantesService(db, eventos);
    enviados = [];
    respuestaIa = async () => decision();
    const ia = {
      activa: () => true,
      embeddings: async () => null,
      chat: async () => ({
        texto: await respuestaIa(),
        modelo: 'm',
        tokensEntrada: 10,
        tokensSalida: 5,
      }),
    } as unknown as IaService;
    const envio = {
      enviarTexto: async (_n: unknown, _a: string, t: string) => {
        enviados.push(t);
        return `wamid.ia${enviados.length}`;
      },
    } as unknown as EnvioWhatsappService;
    agente = new AgenteService(
      db,
      ia,
      new ConocimientoService(db, ia),
      envio,
      {} as MediaWhatsappService,
      eventos,
    );
    await crearNumero(db, 'wuarikes', 'ph1');
    await db
      .getRepository(LineaProducto)
      .save({ tenant: 'wuarikes', nombre: 'Barbería', criterios: 'Dueño' });
  });

  const llega = async (texto = 'Hola, soy la dueña', wamid = 'wamid.1') => {
    await entrantes.procesar(payloadTexto('ph1', wamid, texto));
    return db.getRepository(Conversacion).findOneByOrFail({});
  };

  it('modo responde: envía, guarda el mensaje de la IA, actualiza el lead y deja traza', async () => {
    const conv = await llega();
    await agente.atender(conv.id);

    expect(enviados).toEqual(['¡Hola Rosa! ¿Tu barbería ya está funcionando?']);
    const ia = await db
      .getRepository(Mensaje)
      .findOneByOrFail({ origen: 'ia' });
    expect(ia).toMatchObject({
      direccion: 'saliente',
      waMessageId: 'wamid.ia1',
    });
    const lead = await db.getRepository(Lead).findOneByOrFail({});
    const linea = await db.getRepository(LineaProducto).findOneByOrFail({});
    expect(lead).toMatchObject({
      etapa: 'en_conversacion',
      puntaje: 55,
      lineaId: linea.id,
      datos: { cargo: { valor: 'dueña', evidencia: 'soy la dueña' } },
    });
    expect(
      await db.getRepository(EjecucionIa).countBy({ tipo: 'agente' }),
    ).toBe(1);
    expect(emitidos.map((e) => e.tipo)).toEqual(
      expect.arrayContaining(['mensaje', 'lead']),
    );
  });

  it('modo propone: no envía y deja borrador', async () => {
    await db
      .getRepository(EmpresaConfig)
      .save({ tenant: 'wuarikes', agenteModo: 'propone' });
    const conv = await llega();
    await agente.atender(conv.id);
    expect(enviados).toEqual([]);
    expect(
      (await db.getRepository(Conversacion).findOneByOrFail({ id: conv.id }))
        .borrador,
    ).toContain('¡Hola Rosa!');
  });

  it('en modo humano no hace nada', async () => {
    const conv = await llega();
    await db.getRepository(Conversacion).update(conv.id, { modo: 'humano' });
    await agente.atender(conv.id);
    expect(enviados).toEqual([]);
  });

  it('si un humano toma la conversación mientras la IA piensa, no envía', async () => {
    const conv = await llega();
    respuestaIa = async () => {
      await db.getRepository(Conversacion).update(conv.id, { modo: 'humano' });
      return decision();
    };
    await agente.atender(conv.id);
    expect(enviados).toEqual([]);
  });

  it('pide humano: responde y pasa la conversación a humano', async () => {
    const conv = await llega('quiero hablar con una persona');
    respuestaIa = async () =>
      decision({ respuesta: 'Te paso con un asesor', traspaso: 'pide_humano' });
    await agente.atender(conv.id);
    expect(enviados).toEqual(['Te paso con un asesor']);
    expect(
      (await db.getRepository(Conversacion).findOneByOrFail({ id: conv.id }))
        .modo,
    ).toBe('humano');
  });

  it('lo que no sabe queda como pregunta sin respuesta', async () => {
    const conv = await llega('¿emiten factura?');
    respuestaIa = async () =>
      decision({
        respuesta: 'Lo confirmo y te aviso',
        pregunta_sin_respuesta: '¿Emiten factura?',
      });
    await agente.atender(conv.id);
    expect(await db.getRepository(Pregunta).findOneByOrFail({})).toMatchObject({
      tenant: 'wuarikes',
      conversacionId: conv.id,
      pregunta: '¿Emiten factura?',
    });
  });

  it('no retrocede un lead que ya tiene demo agendada', async () => {
    const conv = await llega();
    await db
      .getRepository(Lead)
      .update({ conversacionId: conv.id }, { etapa: 'demo_agendada' });
    await agente.atender(conv.id);
    expect((await db.getRepository(Lead).findOneByOrFail({})).etapa).toBe(
      'demo_agendada',
    );
  });

  it('decisión ilegible: lanza (la cola reintenta) y no envía nada', async () => {
    const conv = await llega();
    respuestaIa = async () => 'no sé';
    await expect(agente.atender(conv.id)).rejects.toThrow();
    expect(enviados).toEqual([]);
  });

  it('si el último mensaje ya es nuestro, no responde de nuevo', async () => {
    const conv = await llega();
    await agente.atender(conv.id);
    await agente.atender(conv.id);
    expect(enviados).toHaveLength(1);
  });
});
