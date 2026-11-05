import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { crearApp } from './util/app';

describe('GET /health', () => {
  let app: INestApplication;
  beforeAll(async () => { app = await crearApp(); });
  afterAll(async () => { await app.close(); });

  it('responde ok con la base conectada', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, db: true });
  });
});
