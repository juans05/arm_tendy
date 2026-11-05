import { DataSource } from 'typeorm';
import { limpiarBase } from '../../test/util/app';
import { crearDbTest } from '../../test/util/db';
import { DIMENSION_EMBEDDING, IaService } from '../ia/ia.service';
import { ConocimientoService } from './conocimiento.service';
import { Pregunta } from './pregunta.entity';

// Embedding de juguete: una dimensión por palabra clave.
const CLAVES = ['precio', 'horario', 'soporte'];
const vector = (t: string) => {
  const v = new Array(DIMENSION_EMBEDDING).fill(0.001);
  CLAVES.forEach((c, i) => t.toLowerCase().includes(c) && (v[i] = 1));
  return v;
};

describe('ConocimientoService', () => {
  let db: DataSource;
  beforeAll(async () => (db = await crearDbTest()));
  afterAll(() => db.destroy());
  beforeEach(() => limpiarBase(db));

  const sinEmbeddings = () =>
    new ConocimientoService(db, {
      embeddings: async () => null,
    } as unknown as IaService);
  const conEmbeddings = () =>
    new ConocimientoService(db, {
      embeddings: async (ts: string[]) => ts.map(vector),
    } as unknown as IaService);

  it('sin embeddings busca por texto y nunca devuelve otra empresa', async () => {
    const s = sinEmbeddings();
    await s.agregar('a', {
      titulo: 'Precios',
      tipo: 'texto',
      texto: 'El precio del plan es S/ 99',
    });
    await s.agregar('b', {
      titulo: 'Precios B',
      tipo: 'texto',
      texto: 'El precio de B es secreto',
    });
    const r = await s.buscar('a', 'cuál es el precio');
    expect(r).toEqual(['El precio del plan es S/ 99']);
  });

  it('con embeddings ordena por similitud dentro de la empresa', async () => {
    const s = conEmbeddings();
    await s.agregar('a', {
      titulo: 'Horario',
      tipo: 'texto',
      texto: 'Horario de soporte: 9 a 6',
    });
    await s.agregar('a', {
      titulo: 'Precio',
      tipo: 'texto',
      texto: 'Precio: S/ 99',
    });
    await s.agregar('b', {
      titulo: 'Precio B',
      tipo: 'texto',
      texto: 'Precio B: S/ 1',
    });
    const r = await s.buscar('a', 'precio?', 1);
    expect(r).toEqual(['Precio: S/ 99']);
  });

  it('documento vacío se rechaza', async () => {
    await expect(
      sinEmbeddings().agregar('a', {
        titulo: 'x',
        tipo: 'texto',
        texto: '   ',
      }),
    ).rejects.toThrow('no tiene texto');
  });

  it('borrar solo dentro de la empresa y se lleva sus fragmentos', async () => {
    const s = sinEmbeddings();
    const d = await s.agregar('a', {
      titulo: 'x',
      tipo: 'texto',
      texto: 'precio 10',
    });
    await expect(s.borrar('b', d.id)).rejects.toThrow('no encontrado');
    await s.borrar('a', d.id);
    expect(await s.buscar('a', 'precio')).toEqual([]);
  });

  it('pregunta respondida y aprobada pasa a la base; otra empresa no puede tocarla', async () => {
    const s = sinEmbeddings();
    const p = await s.crearPregunta('a', null, '¿Tienen factura electrónica?');
    await expect(s.responderPregunta('b', p.id, 'sí')).rejects.toThrow(
      'no encontrada',
    );
    await expect(s.aprobarPregunta('a', p.id)).rejects.toThrow('respuesta');
    await s.responderPregunta(
      'a',
      p.id,
      'Sí, emitimos factura electrónica SUNAT',
    );
    await s.aprobarPregunta('a', p.id);
    expect(
      (await db.getRepository(Pregunta).findOneByOrFail({ id: p.id })).estado,
    ).toBe('aprobada');
    expect((await s.buscar('a', 'factura electrónica')).join()).toContain(
      'SUNAT',
    );
  });

  it('no repite la misma pregunta abierta de una conversación', async () => {
    const s = sinEmbeddings();
    await s.crearPregunta('a', null, '¿Precio anual?');
    await s.crearPregunta('a', null, '¿Precio anual?');
    expect(await s.listarPreguntas('a')).toHaveLength(1);
  });
});
