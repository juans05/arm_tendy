import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { JWKS_KEY_SET } from '../src/auth/jwks.provider';
import { EntrantesService } from '../src/bandeja/entrantes.service';
import { Conversacion } from '../src/bandeja/conversacion.entity';
import { crearApp } from './util/app';
import { crearFirmador, Firmador } from './util/tokens';
import { crearNumero, payloadTexto } from './util/whatsapp';

describe('Agente y conocimiento (e2e)', () => {
  let app: INestApplication;
  let f: Firmador;
  let db: DataSource;
  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    f = await crearFirmador();
    app = await crearApp((b) =>
      b.overrideProvider(JWKS_KEY_SET).useValue(f.keySet),
    );
    db = app.get(DataSource);
  });
  afterAll(() => app.close());

  // Gerente (primero en entrar) y comercial activo de una empresa.
  async function equipo(tenant: string) {
    const gerente = await f.token({ userId: `g-${tenant}`, tenant });
    const comercial = await f.token({ userId: `c-${tenant}`, tenant });
    await http().get('/me').set(auth(gerente)).expect(200);
    const me = await http().get('/me').set(auth(comercial));
    await http()
      .patch(`/miembros/${me.body.miembro.id}`)
      .set(auth(gerente))
      .send({ estado: 'activo' })
      .expect(200);
    return { gerente, comercial };
  }

  it('solo el gerente sube conocimiento y configura el agente; todos lo leen', async () => {
    const { gerente, comercial } = await equipo('e1');
    await http()
      .post('/conocimiento/texto')
      .set(auth(comercial))
      .send({ titulo: 'x', texto: 'y' })
      .expect(403);
    await http()
      .post('/conocimiento/texto')
      .set(auth(gerente))
      .send({ titulo: 'Precios', texto: 'Plan único: S/ 99' })
      .expect(201);
    const lista = await http()
      .get('/conocimiento')
      .set(auth(comercial))
      .expect(200);
    expect(lista.body.map((d: { titulo: string }) => d.titulo)).toEqual([
      'Precios',
    ]);

    await http()
      .put('/agente/config')
      .set(auth(comercial))
      .send({ agenteModo: 'propone' })
      .expect(403);
    await http()
      .put('/agente/config')
      .set(auth(gerente))
      .send({ agenteModo: 'otro' })
      .expect(400);
    await http()
      .put('/agente/config')
      .set(auth(gerente))
      .send({ agenteModo: 'propone', agenteNombre: 'Wari' })
      .expect(200);
    const c = await http()
      .get('/agente/config')
      .set(auth(comercial))
      .expect(200);
    expect(c.body).toMatchObject({
      agenteModo: 'propone',
      agenteNombre: 'Wari',
      iaActiva: false,
    });
  });

  it('archivo de formato no soportado → 400', async () => {
    const { gerente } = await equipo('e2');
    await http()
      .post('/conocimiento/archivo')
      .set(auth(gerente))
      .attach('archivo', Buffer.from('MZ'), 'virus.exe')
      .expect(400);
  });

  it('el lead y la conversación de otra empresa no se ven ni se tocan', async () => {
    const a = await equipo('ea');
    const b = await equipo('eb');
    await crearNumero(db, 'ea', 'phA');
    await app.get(EntrantesService).procesar(payloadTexto('phA', 'wamid.a1'));
    const conv = await db
      .getRepository(Conversacion)
      .findOneByOrFail({ tenant: 'ea' });

    await http()
      .get(`/conversaciones/${conv.id}/lead`)
      .set(auth(a.comercial))
      .expect(200);
    await http()
      .get(`/conversaciones/${conv.id}/lead`)
      .set(auth(b.gerente))
      .expect(404);
    await http()
      .post(`/conversaciones/${conv.id}/devolver-ia`)
      .set(auth(b.gerente))
      .expect(404);
    const ej = await http()
      .get(`/conversaciones/${conv.id}/ejecuciones`)
      .set(auth(b.gerente))
      .expect(200);
    expect(ej.body).toEqual([]);
  });

  it('devolver a la IA saca la conversación de modo humano', async () => {
    const a = await equipo('ec');
    await crearNumero(db, 'ec', 'phC');
    await app.get(EntrantesService).procesar(payloadTexto('phC', 'wamid.c1'));
    const conv = await db
      .getRepository(Conversacion)
      .findOneByOrFail({ tenant: 'ec' });
    await db.getRepository(Conversacion).update(conv.id, { modo: 'humano' });
    await http()
      .post(`/conversaciones/${conv.id}/devolver-ia`)
      .set(auth(a.comercial))
      .expect(201);
    expect(
      (await db.getRepository(Conversacion).findOneByOrFail({ id: conv.id }))
        .modo,
    ).toBe('ia');
  });
});
