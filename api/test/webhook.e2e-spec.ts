import { INestApplication } from '@nestjs/common';
import { createHmac } from 'crypto';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { crearNumero, payloadTexto } from './util/whatsapp';
import { Mensaje } from '../src/bandeja/mensaje.entity';
import { crearApp } from './util/app';

const firmar = (cuerpo: string) =>
  'sha256=' +
  createHmac('sha256', process.env.META_APP_SECRET!)
    .update(cuerpo)
    .digest('hex');

describe('Webhook WhatsApp (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await crearApp();
    db = app.get(DataSource);
  });
  afterAll(() => app.close());

  it('GET verifica con el token correcto y 403 con otro', async () => {
    const ok = await http().get('/webhooks/whatsapp').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      'hub.challenge': '12345',
    });
    expect(ok.status).toBe(200);
    expect(ok.text).toBe('12345');
    const mal = await http().get('/webhooks/whatsapp').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'otro',
      'hub.challenge': '1',
    });
    expect(mal.status).toBe(403);
  });

  it('firma inválida → 401 sin efectos', async () => {
    await crearNumero(db, 'wuarikes', 'ph1');
    const cuerpo = JSON.stringify(payloadTexto('ph1', 'wamid.malo'));
    const sinFirma = await http()
      .post('/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .send(cuerpo);
    expect(sinFirma.status).toBe(401);
    const mala = await http()
      .post('/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', firmar(cuerpo + ' '))
      .send(cuerpo);
    expect(mala.status).toBe(401);
    await new Promise((r) => setTimeout(r, 200));
    expect(await db.getRepository(Mensaje).count()).toBe(0);
  });

  it('firma válida → 200 y el mensaje queda guardado', async () => {
    await crearNumero(db, 'wuarikes', 'ph9');
    const cuerpo = JSON.stringify(
      payloadTexto('ph9', 'wamid.bueno', 'Hola ARM'),
    );
    const r = await http()
      .post('/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', firmar(cuerpo))
      .send(cuerpo);
    expect(r.status).toBe(200);
    // Se guarda antes de responder: si Meta recibe 200, el mensaje ya está en la base.
    const m = await db
      .getRepository(Mensaje)
      .findOneBy({ waMessageId: 'wamid.bueno' });
    expect(m).toMatchObject({ tenant: 'wuarikes', texto: 'Hola ARM' });
  });

  it('si no se pudo guardar responde 500 para que Meta reintente', async () => {
    await crearNumero(db, 'wuarikes', 'ph8');
    const cuerpo = JSON.stringify(
      payloadTexto('ph8', 'wamid.largo', 'x', '9'.repeat(40)),
    );
    const r = await http()
      .post('/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', firmar(cuerpo))
      .send(cuerpo);
    expect(r.status).toBe(500);
  });
});
