import { BadGatewayException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { limpiarBase } from '../../test/util/app';
import { crearDbTest } from '../../test/util/db';
import { ConexionWhatsappService } from './conexion-whatsapp.service';
import { MetaError, MetaGraph } from './meta-graph.client';
import { NumeroWhatsapp } from './numero-whatsapp.entity';

type Llamada = { metodo: string; ruta: string; opts?: { token?: string; body?: any; query?: Record<string, string> } };

// MetaGraph falso: registra las llamadas y responde según la ruta.
function metaFalso(sobre: Record<string, (l: Llamada) => unknown> = {}) {
  const llamadas: Llamada[] = [];
  const base: Record<string, (l: Llamada) => unknown> = {
    'GET /oauth/access_token': () => ({ access_token: 'tok-nuevo' }),
    'GET /waba1/phone_numbers': () => ({ data: [{ id: 'ph1' }] }),
    'POST /waba1/subscribed_apps': () => ({ success: true }),
    'POST /ph1/register': () => ({ success: true }),
    'POST /ph1': () => ({ success: true }),
    'GET /ph1': () => ({ display_phone_number: '+51 999 888 777', verified_name: 'Wuarikes Ventas' }),
  };
  const meta = {
    llamadas,
    async llamar(metodo: string, ruta: string, opts?: Llamada['opts']) {
      const l = { metodo, ruta, opts };
      llamadas.push(l);
      const h = sobre[`${metodo} ${ruta}`] ?? base[`${metodo} ${ruta}`];
      if (!h) throw new Error(`ruta no esperada ${metodo} ${ruta}`);
      return h(l);
    },
  };
  return meta as unknown as MetaGraph & { llamadas: Llamada[] };
}

describe('ConexionWhatsappService', () => {
  let db: DataSource;
  const svc = (meta: MetaGraph) => new ConexionWhatsappService(db.getRepository(NumeroWhatsapp), meta);
  const rutas = (m: { llamadas: Llamada[] }) => m.llamadas.map((l) => `${l.metodo} ${l.ruta}`);

  beforeAll(async () => {
    db = await crearDbTest();
  });
  afterAll(() => db.destroy());
  beforeEach(() => limpiarBase(db));

  it('conecta con código: canjea, suscribe, registra, redirige por número y guarda', async () => {
    const meta = metaFalso();
    const n = await svc(meta).conectar('wuarikes', { code: 'c1', wabaId: 'waba1', phoneNumberId: 'ph1' });

    expect(rutas(meta)).toEqual([
      'GET /oauth/access_token',
      'POST /waba1/subscribed_apps',
      'POST /ph1/register',
      'POST /ph1',
      'GET /ph1',
    ]);
    const redir = meta.llamadas[3].opts!.body.webhook_configuration;
    expect(redir.override_callback_uri).toBe(`${process.env.ARM_PUBLIC_URL}/webhooks/whatsapp`);
    expect(redir.verify_token).toBe(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);
    expect(n).toEqual({ id: expect.any(String), telefono: '51999888777', nombreVerificado: 'Wuarikes Ventas', coexistencia: false, activo: true });

    const [cruda] = await db.query('SELECT token FROM numeros_whatsapp');
    expect(cruda.token).not.toContain('tok-nuevo');
    expect((await svc(meta).porPhoneNumberId('ph1'))!.token).toBe('tok-nuevo');
  });

  it('coexistencia no llama a register', async () => {
    const meta = metaFalso();
    await svc(meta).conectar('wuarikes', { code: 'c1', wabaId: 'waba1', phoneNumberId: 'ph1', coexistencia: true });
    expect(rutas(meta)).not.toContain('POST /ph1/register');
  });

  it('sin phoneNumberId toma el primero de la cuenta', async () => {
    const meta = metaFalso();
    await svc(meta).conectar('wuarikes', { code: 'c1', wabaId: 'waba1' });
    expect(rutas(meta)).toContain('GET /waba1/phone_numbers');
    expect(await svc(meta).porPhoneNumberId('ph1')).toMatchObject({ tenant: 'wuarikes', wabaId: 'waba1' });
  });

  it('redirección por número rechazada y cuenta con un número → redirige la cuenta', async () => {
    const meta = metaFalso({
      'POST /ph1': () => {
        throw new MetaError('no soportado');
      },
    });
    await svc(meta).conectar('wuarikes', { code: 'c1', wabaId: 'waba1', phoneNumberId: 'ph1' });
    const subs = meta.llamadas.filter((l) => l.ruta === '/waba1/subscribed_apps');
    expect(subs.at(-1)!.opts!.body).toEqual({
      override_callback_uri: `${process.env.ARM_PUBLIC_URL}/webhooks/whatsapp`,
      verify_token: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    });
    expect(await svc(meta).listar('wuarikes')).toHaveLength(1);
  });

  it('redirección por número rechazada y cuenta con varios números → 409 sin guardar', async () => {
    const meta = metaFalso({
      'POST /ph1': () => {
        throw new MetaError('no soportado');
      },
      'GET /waba1/phone_numbers': () => ({ data: [{ id: 'ph1' }, { id: 'ph2' }] }),
    });
    const e = await svc(meta).conectar('wuarikes', { code: 'c1', wabaId: 'waba1', phoneNumberId: 'ph1' }).catch((x) => x);
    expect(e).toBeInstanceOf(ConflictException);
    expect(e.message).toBe('Este número comparte cuenta de WhatsApp Business con otros números; conéctalo desde una cuenta propia');
    expect(await db.getRepository(NumeroWhatsapp).count()).toBe(0);
  });

  it('número de otra empresa → 409 sin tocarlo', async () => {
    await svc(metaFalso()).conectar('tendy', { code: 'c0', wabaId: 'waba1', phoneNumberId: 'ph1' });
    const [antes] = await db.query('SELECT tenant, token FROM numeros_whatsapp');

    const meta = metaFalso();
    const e = await svc(meta).conectar('wuarikes', { code: 'c1', wabaId: 'waba1', phoneNumberId: 'ph1' }).catch((x) => x);
    expect(e).toBeInstanceOf(ConflictException);
    expect(e.message).toBe('Este número de WhatsApp ya está conectado a otra empresa');
    expect(rutas(meta)).not.toContain('GET /oauth/access_token');
    expect(await db.query('SELECT tenant, token FROM numeros_whatsapp')).toEqual([antes]);
  });

  it('número de otra empresa descubierto en la cuenta → 409 sin tocarlo', async () => {
    await svc(metaFalso()).conectar('tendy', { code: 'c0', wabaId: 'waba1', phoneNumberId: 'ph1' });
    const meta = metaFalso();
    await expect(svc(meta).conectar('wuarikes', { code: 'c1', wabaId: 'waba1' })).rejects.toBeInstanceOf(ConflictException);
    expect(rutas(meta)).not.toContain('POST /waba1/subscribed_apps');
    expect((await svc(meta).porPhoneNumberId('ph1'))!.tenant).toBe('tendy');
  });

  it('falla de Meta no guarda nada', async () => {
    const meta = metaFalso({
      'POST /waba1/subscribed_apps': () => {
        throw new MetaError('caído');
      },
    });
    await expect(svc(meta).conectar('wuarikes', { code: 'c1', wabaId: 'waba1', phoneNumberId: 'ph1' })).rejects.toBeInstanceOf(BadGatewayException);
    expect(await db.getRepository(NumeroWhatsapp).count()).toBe(0);
  });

  it('reconectar el mismo número en la misma empresa actualiza el token', async () => {
    await svc(metaFalso()).conectar('wuarikes', { code: 'c0', wabaId: 'waba1', phoneNumberId: 'ph1' });
    const meta = metaFalso({ 'GET /oauth/access_token': () => ({ access_token: 'tok-2' }) });
    await svc(meta).conectar('wuarikes', { code: 'c1', wabaId: 'waba1', phoneNumberId: 'ph1' });
    expect(await db.getRepository(NumeroWhatsapp).count()).toBe(1);
    expect((await svc(meta).porPhoneNumberId('ph1'))!.token).toBe('tok-2');
  });

  it('conectar existente usa el token dado sin canjear código ni registrar', async () => {
    const meta = metaFalso();
    await svc(meta).conectarExistente('wuarikes', { phoneNumberId: 'ph1', wabaId: 'waba1', token: 'tok-manual' });
    expect(rutas(meta)).toEqual(['POST /waba1/subscribed_apps', 'POST /ph1', 'GET /ph1']);
    expect(meta.llamadas.every((l) => l.opts?.token === 'tok-manual')).toBe(true);
    expect((await svc(meta).porPhoneNumberId('ph1'))!.token).toBe('tok-manual');
  });

  it('listar no expone el token', async () => {
    await svc(metaFalso()).conectar('wuarikes', { code: 'c1', wabaId: 'waba1', phoneNumberId: 'ph1' });
    const [n] = await svc(metaFalso()).listar('wuarikes');
    expect(Object.keys(n).sort()).toEqual(['activo', 'coexistencia', 'id', 'nombreVerificado', 'telefono']);
    expect(await svc(metaFalso()).listar('tendy')).toEqual([]);
  });
});
