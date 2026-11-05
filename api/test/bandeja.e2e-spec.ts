import { INestApplication } from '@nestjs/common';
import { createHmac } from 'crypto';
import * as http from 'http';
import { AddressInfo } from 'net';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { JWKS_KEY_SET } from '../src/auth/jwks.provider';
import { crearApp } from './util/app';
import { crearFirmador, Firmador } from './util/tokens';
import { crearNumero, payloadTexto } from './util/whatsapp';

const firmar = (cuerpo: string) =>
  'sha256=' +
  createHmac('sha256', process.env.META_APP_SECRET!)
    .update(cuerpo)
    .digest('hex');

// Cliente SSE mínimo: acumula lo recibido.
function escuchar(
  url: string,
): Promise<{ datos: () => string; status: number; cerrar: () => void }> {
  return new Promise((ok, mal) => {
    let buf = '';
    const req = http.get(url, (res) => {
      res.on('data', (d) => (buf += d));
      ok({
        datos: () => buf,
        status: res.statusCode!,
        cerrar: () => req.destroy(),
      });
    });
    req.on('error', (e) =>
      e.message.includes('socket hang up') ? undefined : mal(e),
    );
  });
}

describe('Bandeja (e2e)', () => {
  let app: INestApplication;
  let f: Firmador;
  let base: string;

  beforeAll(async () => {
    f = await crearFirmador();
    app = await crearApp((b) =>
      b.overrideProvider(JWKS_KEY_SET).useValue(f.keySet),
    );
    await app.listen(0);
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  afterAll(() => app.close());

  it('SSE no cruza empresas', async () => {
    const db = app.get(DataSource);
    await crearNumero(db, 'empresa-a', 'phA');
    await crearNumero(db, 'empresa-b', 'phB');
    const ta = await f.token({ userId: 'ua', tenant: 'empresa-a' });
    const tb = await f.token({ userId: 'ub', tenant: 'empresa-b' });

    const a = await escuchar(`${base}/eventos?token=${ta}`);
    const b = await escuchar(`${base}/eventos?token=${tb}`);
    expect([a.status, b.status]).toEqual([200, 200]);

    const cuerpo = JSON.stringify(
      payloadTexto('phA', 'wamid.sse', 'solo para A'),
    );
    await request(app.getHttpServer())
      .post('/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', firmar(cuerpo))
      .send(cuerpo)
      .expect(200);

    const fin = Date.now() + 2000;
    while (!a.datos().includes('solo para A') && Date.now() < fin)
      await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 150));
    a.cerrar();
    b.cerrar();
    expect(a.datos()).toContain('solo para A');
    expect(b.datos()).not.toContain('solo para A');
  });

  it('SSE sin token → 401 y con token en cabecera en otra ruta sigue funcionando', async () => {
    const sin = await escuchar(`${base}/eventos`);
    sin.cerrar();
    expect(sin.status).toBe(401);
    const t = await f.token({ userId: 'uc', tenant: 'empresa-c' });
    await request(app.getHttpServer())
      .get(`/conversaciones?token=${t}`)
      .expect(401);
    await request(app.getHttpServer())
      .get('/conversaciones')
      .set('Authorization', `Bearer ${t}`)
      .expect(200);
  });

  it('responder valida el texto', async () => {
    const t = await f.token({ userId: 'ud', tenant: 'empresa-d' });
    await request(app.getHttpServer())
      .post('/conversaciones/00000000-0000-0000-0000-000000000000/mensajes')
      .set('Authorization', `Bearer ${t}`)
      .send({ texto: '' })
      .expect(400);
  });
});
