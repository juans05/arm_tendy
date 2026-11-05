import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { limpiarBase } from '../../test/util/app';
import { crearDbTest } from '../../test/util/db';
import { SuiteUser } from '../auth/suite-user';
import { Miembro } from '../miembros/miembro.entity';
import { MiembrosService } from '../miembros/miembros.service';
import { LineaProducto } from './linea-producto.entity';
import { LineasService } from './lineas.service';

const usuario = (userId: string, tenant = 'wuarikes'): SuiteUser => ({
  userId,
  username: userId,
  nombre: userId,
  tenant,
  apps: ['arm'],
});

describe('LineasService', () => {
  let db: DataSource;
  let svc: LineasService;
  let miembros: MiembrosService;

  beforeAll(async () => {
    db = await crearDbTest();
    miembros = new MiembrosService(db, db.getRepository(Miembro));
    svc = new LineasService(
      db.getRepository(LineaProducto),
      db.getRepository(Miembro),
    );
  });
  afterAll(() => db.destroy());
  beforeEach(() => limpiarBase(db));

  it('crea con duración 30 por defecto', async () => {
    const l = await svc.crear('wuarikes', { nombre: 'Barbería' });
    expect(l).toMatchObject({
      nombre: 'Barbería',
      duracionDemoMin: 30,
      activa: true,
      criterios: '',
    });
  });

  it('nombre repetido en la misma empresa → 409', async () => {
    await svc.crear('wuarikes', { nombre: 'Barbería' });
    const e = await svc
      .crear('wuarikes', { nombre: 'Barbería' })
      .catch((x) => x);
    expect(e).toBeInstanceOf(ConflictException);
    expect(e.message).toBe('Ya existe una línea con ese nombre');
  });

  it('renombrar a un nombre existente → 409', async () => {
    await svc.crear('wuarikes', { nombre: 'Barbería' });
    const spa = await svc.crear('wuarikes', { nombre: 'Spa' });
    await expect(
      svc.actualizar('wuarikes', spa.id, { nombre: 'Barbería' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('mismo nombre en otra empresa se permite', async () => {
    await svc.crear('wuarikes', { nombre: 'Principal' });
    await expect(
      svc.crear('tendy', { nombre: 'Principal' }),
    ).resolves.toMatchObject({ tenant: 'tendy' });
  });

  it('comercialIds de otra empresa → 400', async () => {
    const ajeno = await miembros.entrar(usuario('u9', 'tendy'));
    await expect(
      svc.crear('wuarikes', { nombre: 'Spa', comercialIds: [ajeno.id] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('asigna y devuelve comerciales de la línea', async () => {
    await miembros.entrar(usuario('u1'));
    const ana = await miembros.entrar(usuario('u2'));
    await miembros.actualizar('wuarikes', ana.id, { estado: 'activo' });
    const l = await svc.crear('wuarikes', {
      nombre: 'Spa',
      comercialIds: [ana.id],
    });
    expect(
      (await svc.comercialesDeLinea('wuarikes', l.id)).map((m) => m.id),
    ).toEqual([ana.id]);
  });

  it('comercialesDeLinea sin asignados devuelve activos que reciben demos', async () => {
    const g = await miembros.entrar(usuario('u1'));
    const pendiente = await miembros.entrar(usuario('u2'));
    await miembros.actualizar('wuarikes', g.id, { recibeDemos: true });
    await miembros.actualizar('wuarikes', pendiente.id, { recibeDemos: true }); // sigue pendiente
    const l = await svc.crear('wuarikes', { nombre: 'Restaurante' });
    expect(
      (await svc.comercialesDeLinea('wuarikes', l.id)).map((m) => m.id),
    ).toEqual([g.id]);
  });

  it('asignado que se desactiva deja de hacer demos y se cae al conjunto por defecto', async () => {
    const g = await miembros.entrar(usuario('u1'));
    await miembros.actualizar('wuarikes', g.id, { recibeDemos: true });
    const ana = await miembros.entrar(usuario('u2'));
    await miembros.actualizar('wuarikes', ana.id, { estado: 'activo' });
    const l = await svc.crear('wuarikes', {
      nombre: 'Spa',
      comercialIds: [ana.id],
    });
    await miembros.actualizar('wuarikes', ana.id, { estado: 'inactivo' });
    expect(
      (await svc.comercialesDeLinea('wuarikes', l.id)).map((m) => m.id),
    ).toEqual([g.id]);
  });

  it('comercialIds de un miembro no activo → 400', async () => {
    await miembros.entrar(usuario('u1'));
    const pendiente = await miembros.entrar(usuario('u2'));
    await expect(
      svc.crear('wuarikes', { nombre: 'Spa', comercialIds: [pendiente.id] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aislamiento entre empresas', async () => {
    const l = await svc.crear('wuarikes', { nombre: 'Barbería' });
    await expect(
      svc.actualizar('tendy', l.id, { activa: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.comercialesDeLinea('tendy', l.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(await svc.listar('tendy')).toEqual([]);
  });
});
