import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { crearApp } from './util/app';

describe('Seguridad (e2e)', () => {
  let app: INestApplication;
  const previo = process.env.LIMITE_POR_MINUTO;

  beforeAll(async () => {
    process.env.LIMITE_POR_MINUTO = '3';
    app = await crearApp();
  });
  afterAll(async () => {
    process.env.LIMITE_POR_MINUTO = previo;
    await app.close();
  });

  it('corta con 429 al pasar el límite de peticiones por minuto', async () => {
    for (let i = 0; i < 3; i++)
      await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer()).get('/health').expect(429);
  });

  it('el webhook de Meta no tiene límite', async () => {
    for (let i = 0; i < 5; i++)
      await request(app.getHttpServer())
        .get('/webhooks/whatsapp')
        .expect((r) => expect(r.status).not.toBe(429));
  });
});
