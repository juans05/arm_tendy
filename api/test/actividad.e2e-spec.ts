import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { JWKS_KEY_SET } from '../src/auth/jwks.provider';
import { EntrantesService } from '../src/bandeja/entrantes.service';
import { Lead } from '../src/leads/lead.entity';
import { crearApp } from './util/app';
import { crearFirmador, Firmador } from './util/tokens';
import { crearNumero, payloadTexto } from './util/whatsapp';

// Tabla de leads, notas, tareas y vistas por HTTP: lectura de la URL, validación y aislamiento por empresa.
describe('Tabla, notas, tareas y vistas (e2e)', () => {
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

  async function empresa(tenant: string) {
    const gerente = await f.token({ userId: `g-${tenant}`, tenant });
    await http().get('/me').set(auth(gerente)).expect(200);
    await crearNumero(db, tenant, `ph-${tenant}`);
    await app
      .get(EntrantesService)
      .procesar(payloadTexto(`ph-${tenant}`, `wamid.${tenant}`, 'Hola'));
    const lead = await db.getRepository(Lead).findOneByOrFail({ tenant });
    return { gerente, lead };
  }

  it('la tabla lee etapas separadas por coma, booleanos y páginas de la URL', async () => {
    const { gerente, lead } = await empresa('a1');
    const r = await http()
      .get(
        '/leads/tabla?etapas=nuevo,ganado&calificado=false&pagina=1&porPagina=10&q=Rosa',
      )
      .set(auth(gerente))
      .expect(200);
    expect(r.body).toMatchObject({ total: 1, items: [{ id: lead.id }] });
    await http()
      .get('/leads/tabla?etapas=volando')
      .set(auth(gerente))
      .expect(400);
    await http()
      .get('/leads/tabla?porPagina=500')
      .set(auth(gerente))
      .expect(400);
    await http().get('/leads/tabla?duenoId=x').set(auth(gerente)).expect(400);
    const uno = await http()
      .get(`/leads/${lead.id}`)
      .set(auth(gerente))
      .expect(200);
    expect(uno.body.contacto.nombre).toBe('Rosa');
  });

  it('notas, tareas y línea de tiempo; otra empresa no las ve', async () => {
    const { gerente, lead } = await empresa('a2');
    const otra = await empresa('a3');
    await http()
      .post(`/leads/${lead.id}/notas`)
      .set(auth(gerente))
      .send({ texto: '' })
      .expect(400);
    const nota = await http()
      .post(`/leads/${lead.id}/notas`)
      .set(auth(gerente))
      .send({ texto: 'Pidió precio por 3 locales' })
      .expect(201);
    const tarea = await http()
      .post(`/leads/${lead.id}/tareas`)
      .set(auth(gerente))
      .send({ titulo: 'Llamar', venceEn: '2030-01-01T15:00:00Z' })
      .expect(201);
    await http()
      .patch(`/tareas/${tarea.body.id}`)
      .set(auth(gerente))
      .send({ estado: 'hecha' })
      .expect(200);
    const tl = await http()
      .get(`/leads/${lead.id}/actividad`)
      .set(auth(gerente))
      .expect(200);
    expect(tl.body.map((x: { tipo: string }) => x.tipo).sort()).toEqual([
      'nota',
      'tarea',
    ]);
    const hechas = await http()
      .get('/tareas?estado=hecha')
      .set(auth(gerente))
      .expect(200);
    expect(hechas.body[0]).toMatchObject({
      titulo: 'Llamar',
      lead: { id: lead.id, contacto: { nombre: 'Rosa' } },
    });

    await http()
      .get(`/leads/${lead.id}/actividad`)
      .set(auth(otra.gerente))
      .expect(404);
    await http()
      .delete(`/notas/${nota.body.id}`)
      .set(auth(otra.gerente))
      .expect(404);
    await http()
      .patch(`/tareas/${tarea.body.id}`)
      .set(auth(otra.gerente))
      .send({ estado: 'pendiente' })
      .expect(404);
    await http()
      .delete(`/notas/${nota.body.id}`)
      .set(auth(gerente))
      .expect(204);
  });

  it('vistas: valida los filtros guardados y no guarda la página', async () => {
    const { gerente } = await empresa('a4');
    await http()
      .post('/vistas')
      .set(auth(gerente))
      .send({
        nombre: 'Mala',
        filtros: { etapas: ['volando'] },
        compartida: false,
      })
      .expect(400);
    const v = await http()
      .post('/vistas')
      .set(auth(gerente))
      .send({
        nombre: 'Demos',
        filtros: { etapas: ['demo_agendada'], orden: 'puntaje', pagina: 3 },
        compartida: true,
      })
      .expect(201);
    expect(v.body.filtros).toEqual({
      etapas: ['demo_agendada'],
      orden: 'puntaje',
    });
    const lista = await http().get('/vistas').set(auth(gerente)).expect(200);
    expect(lista.body.map((x: { nombre: string }) => x.nombre)).toEqual([
      'Demos',
    ]);
    await http().delete(`/vistas/${v.body.id}`).set(auth(gerente)).expect(204);
  });
});
