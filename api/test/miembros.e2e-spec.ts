import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { JWKS_KEY_SET } from '../src/auth/jwks.provider';
import { crearApp } from './util/app';
import { crearFirmador, Firmador } from './util/tokens';

describe('Miembros (e2e)', () => {
  let app: INestApplication;
  let f: Firmador;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    f = await crearFirmador();
    app = await crearApp((b) => b.overrideProvider(JWKS_KEY_SET).useValue(f.keySet));
  });
  afterAll(() => app.close());

  it('flujo de alta: gerente, pendiente, activación y permisos', async () => {
    const gerente = await f.token({ userId: 'u1', tenant: 'wuarikes', nombre: 'Juan' });
    const segundo = await f.token({ userId: 'u2', tenant: 'wuarikes', nombre: 'Ana' });

    const me1 = await http().get('/me').set('Authorization', `Bearer ${gerente}`);
    expect(me1.status).toBe(200);
    expect(me1.body).toMatchObject({ empresa: 'wuarikes', miembro: { rol: 'gerente', estado: 'activo' } });

    const me2 = await http().get('/me').set('Authorization', `Bearer ${segundo}`);
    expect(me2.status).toBe(200);
    expect(me2.body.miembro).toMatchObject({ rol: 'comercial', estado: 'pendiente' });

    const pendiente = await http().get('/miembros').set('Authorization', `Bearer ${segundo}`);
    expect(pendiente.status).toBe(403);
    expect(pendiente.body.code).toBe('MIEMBRO_PENDIENTE');

    const activar = await http().patch(`/miembros/${me2.body.miembro.id}`).set('Authorization', `Bearer ${gerente}`)
      .send({ estado: 'activo', recibeDemos: true });
    expect(activar.status).toBe(200);
    expect(activar.body).toMatchObject({ estado: 'activo', recibeDemos: true });

    const comercial = await http().get('/miembros').set('Authorization', `Bearer ${segundo}`);
    expect(comercial.status).toBe(403);
    expect(comercial.body.code).toBe('SIN_PERMISO');

    const lista = await http().get('/miembros').set('Authorization', `Bearer ${gerente}`);
    expect(lista.body).toHaveLength(2);
  });

  it('token sin arm → 403 SIN_ARM', async () => {
    const t = await f.token({ userId: 'u3', tenant: 'wuarikes', apps: '["arp"]' });
    const r = await http().get('/me').set('Authorization', `Bearer ${t}`);
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('SIN_ARM');
  });

  it('sin token → 401', async () => {
    expect((await http().get('/me')).status).toBe(401);
  });

  it('gerente de otra empresa no puede editar → 404', async () => {
    const a = await http().get('/me').set('Authorization', `Bearer ${await f.token({ userId: 'u1', tenant: 'wuarikes' })}`);
    const tendy = await f.token({ userId: 'u9', tenant: 'tendy' });
    const r = await http().patch(`/miembros/${a.body.miembro.id}`).set('Authorization', `Bearer ${tendy}`).send({ recibeDemos: true });
    expect(r.status).toBe(404);
  });

  it.each([[{ rol: null }], [{ estado: null }], [{ recibeDemos: null }]])('campo en null %p → 400', async (cuerpo) => {
    const g = await f.token({ userId: 'u1', tenant: 'wuarikes' });
    const me = await http().get('/me').set('Authorization', `Bearer ${g}`);
    const r = await http().patch(`/miembros/${me.body.miembro.id}`).set('Authorization', `Bearer ${g}`).send(cuerpo);
    expect(r.status).toBe(400);
  });

  it.each([[{ nombre: null }], [{ activa: null }], [{ duracionDemoMin: null }], [{ criterios: null }]])('línea con campo en null %p → 400', async (cuerpo) => {
    const g = await f.token({ userId: 'u1', tenant: 'wuarikes' });
    const linea = await http().post('/lineas').set('Authorization', `Bearer ${g}`).send({ nombre: `L-${Math.random()}` });
    expect(linea.status).toBe(201);
    const r = await http().patch(`/lineas/${linea.body.id}`).set('Authorization', `Bearer ${g}`).send(cuerpo);
    expect(r.status).toBe(400);
  });

  it('celular inválido → 400', async () => {
    const g = await f.token({ userId: 'u1', tenant: 'wuarikes' });
    const me = await http().get('/me').set('Authorization', `Bearer ${g}`);
    const r = await http().patch(`/miembros/${me.body.miembro.id}`).set('Authorization', `Bearer ${g}`).send({ celularAlertas: 'abc' });
    expect(r.status).toBe(400);
  });
});
