import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { JWKS_KEY_SET } from '../src/auth/jwks.provider';
import { EntrantesService } from '../src/bandeja/entrantes.service';
import { Lead } from '../src/leads/lead.entity';
import { crearApp } from './util/app';
import { crearFirmador, Firmador } from './util/tokens';
import { crearNumero, payloadTexto } from './util/whatsapp';

// Embudo, calendario, alertas y panel a través de HTTP: permisos, validaciones y aislamiento por empresa.
describe('Embudo, calendario y panel (e2e)', () => {
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

  async function equipo(tenant: string) {
    const gerente = await f.token({ userId: `g-${tenant}`, tenant });
    const comercial = await f.token({ userId: `c-${tenant}`, tenant });
    await http().get('/me').set(auth(gerente)).expect(200);
    const me = await http().get('/me').set(auth(comercial));
    const comercialId = me.body.miembro.id as string;
    await http()
      .patch(`/miembros/${comercialId}`)
      .set(auth(gerente))
      .send({ estado: 'activo' })
      .expect(200);
    return { gerente, comercial, comercialId };
  }

  async function lead(tenant: string, ph: string) {
    await crearNumero(db, tenant, ph);
    await app
      .get(EntrantesService)
      .procesar(payloadTexto(ph, `wamid.${ph}`, 'Hola'));
    return db.getRepository(Lead).findOneByOrFail({ tenant });
  }

  it('embudo: validaciones y un comercial no reasigna leads', async () => {
    const { gerente, comercial, comercialId } = await equipo('v1');
    const l = await lead('v1', 'phv1');
    await http()
      .patch(`/leads/${l.id}`)
      .set(auth(gerente))
      .send({ etapa: 'ganado' })
      .expect(400);
    await http()
      .patch(`/leads/${l.id}`)
      .set(auth(gerente))
      .send({ etapa: 'volando' })
      .expect(400);
    await http()
      .patch(`/leads/${l.id}`)
      .set(auth(comercial))
      .send({ duenoId: comercialId })
      .expect(200);
    const lista = await http().get('/leads').set(auth(comercial)).expect(200);
    expect(lista.body).toHaveLength(1);
    const h = await http()
      .get(`/leads/${l.id}/historial`)
      .set(auth(gerente))
      .expect(200);
    expect(h.body).toEqual([]);
  });

  it('los leads de otra empresa no se ven ni se tocan', async () => {
    await equipo('v2');
    const ajeno = await equipo('v3');
    const l = await lead('v2', 'phv2');
    await http()
      .patch(`/leads/${l.id}`)
      .set(auth(ajeno.gerente))
      .send({ etapa: 'seguimiento' })
      .expect(404);
    expect(
      (await http().get('/leads').set(auth(ajeno.gerente)).expect(200)).body,
    ).toEqual([]);
  });

  it('calendario: citas que se cruzan → 409 y un comercial no agenda a otro', async () => {
    const { gerente, comercial, comercialId } = await equipo('v4');
    const cita = {
      miembroId: comercialId,
      inicio: '2030-01-07T15:00:00.000Z',
      titulo: 'Demo',
    };
    await http().post('/citas').set(auth(gerente)).send(cita).expect(201);
    await http()
      .post('/citas')
      .set(auth(comercial))
      .send({ ...cita, inicio: '2030-01-07T15:15:00.000Z' })
      .expect(409);
    const yo = await http().get('/me').set(auth(gerente));
    await http()
      .post('/citas')
      .set(auth(comercial))
      .send({ ...cita, miembroId: yo.body.miembro.id })
      .expect(403);
    await http()
      .put(`/miembros/${comercialId}/horarios`)
      .set(auth(comercial))
      .send({ franjas: [{ dia: 1, desde: '09:00', hasta: '13:00' }] })
      .expect(200);
    await http()
      .put(`/miembros/${comercialId}/horarios`)
      .set(auth(comercial))
      .send({ franjas: [{ dia: 9, desde: '09:00', hasta: '13:00' }] })
      .expect(400);
    const citas = await http()
      .get('/citas?desde=2030-01-01T00:00:00Z&hasta=2030-02-01T00:00:00Z')
      .set(auth(comercial))
      .expect(200);
    expect(citas.body).toHaveLength(1);
  });

  it('panel y Excel solo para el gerente', async () => {
    const { gerente, comercial } = await equipo('v5');
    const q = '?desde=2026-01-01T00:00:00Z&hasta=2030-01-01T00:00:00Z';
    await http().get(`/panel/kpis${q}`).set(auth(comercial)).expect(403);
    const k = await http()
      .get(`/panel/kpis${q}`)
      .set(auth(gerente))
      .expect(200);
    expect(k.body).toHaveProperty('actual.embudo.leads', 0);
    const x = await http()
      .get(`/panel/excel${q}`)
      .set(auth(gerente))
      .expect(200);
    expect(x.headers['content-type']).toContain('spreadsheetml');
  });

  it('alertas: cada uno ve las suyas y elige cuáles apagar', async () => {
    const { comercial } = await equipo('v6');
    expect(
      (await http().get('/alertas').set(auth(comercial)).expect(200)).body,
    ).toEqual([]);
    await http()
      .put('/alertas/preferencias')
      .set(auth(comercial))
      .send({ alertasOff: ['resumen_diario'] })
      .expect(200);
    const p = await http()
      .get('/alertas/preferencias')
      .set(auth(comercial))
      .expect(200);
    expect(p.body).toEqual({ alertasOff: ['resumen_diario'] });
  });

  it('un comercial no ve ni devuelve a la IA el chat de otro', async () => {
    const { gerente, comercial } = await equipo('v9');
    const gId = (await http().get('/me').set(auth(gerente))).body.miembro.id;
    const l = await lead('v9', 'phv9');
    await db.getRepository(Lead).update(l.id, { duenoId: gId });
    const c = l.conversacionId;
    await http()
      .get(`/conversaciones/${c}/lead`)
      .set(auth(comercial))
      .expect(404);
    await http()
      .get(`/conversaciones/${c}/ejecuciones`)
      .set(auth(comercial))
      .expect(404);
    await http()
      .post(`/conversaciones/${c}/devolver-ia`)
      .set(auth(comercial))
      .expect(404);
    await http()
      .get(`/conversaciones/${c}/lead`)
      .set(auth(gerente))
      .expect(200);
  });

  it('rechaza una zona horaria que no existe', async () => {
    const { gerente } = await equipo('v10');
    await http()
      .put('/agente/config')
      .set(auth(gerente))
      .send({ zonaHoraria: 'Lima' })
      .expect(400);
    await http()
      .put('/agente/config')
      .set(auth(gerente))
      .send({ zonaHoraria: 'America/Lima' })
      .expect(200);
  });
});
