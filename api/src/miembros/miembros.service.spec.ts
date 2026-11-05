import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { crearDbTest } from '../../test/util/db';
import { limpiarBase } from '../../test/util/app';
import { SuiteUser } from '../auth/suite-user';
import { Miembro } from './miembro.entity';
import { MiembrosService } from './miembros.service';

const usuario = (
  userId: string,
  tenant = 'wuarikes',
  nombre = userId,
): SuiteUser => ({
  userId,
  username: userId.toUpperCase(),
  nombre,
  tenant,
  apps: ['arm'],
});

describe('MiembrosService', () => {
  let db: DataSource;
  let svc: MiembrosService;

  beforeAll(async () => {
    db = await crearDbTest();
    svc = new MiembrosService(db, db.getRepository(Miembro));
  });
  afterAll(() => db.destroy());
  beforeEach(() => limpiarBase(db));

  it('primer miembro es gerente activo', async () => {
    const m = await svc.entrar(usuario('u1'));
    expect(m).toMatchObject({
      rol: 'gerente',
      estado: 'activo',
      tenant: 'wuarikes',
      userId: 'u1',
    });
  });

  it('segundo miembro queda comercial pendiente', async () => {
    await svc.entrar(usuario('u1'));
    expect(await svc.entrar(usuario('u2'))).toMatchObject({
      rol: 'comercial',
      estado: 'pendiente',
    });
  });

  it('primer miembro concurrente: un solo gerente', async () => {
    await Promise.all([
      svc.entrar(usuario('u1')),
      svc.entrar(usuario('u2')),
      svc.entrar(usuario('u3')),
    ]);
    const gerentes = (await svc.listar('wuarikes')).filter(
      (m) => m.rol === 'gerente',
    );
    expect(gerentes).toHaveLength(1);
  });

  it('cada empresa tiene su propio primer gerente', async () => {
    await svc.entrar(usuario('u1', 'wuarikes'));
    expect(await svc.entrar(usuario('u9', 'tendy'))).toMatchObject({
      rol: 'gerente',
      estado: 'activo',
    });
  });

  it('entrar de nuevo actualiza el nombre y no duplica', async () => {
    await svc.entrar(usuario('u1', 'wuarikes', 'Juan'));
    const m = await svc.entrar(usuario('u1', 'wuarikes', 'Juan Saavedra'));
    expect(m.nombre).toBe('Juan Saavedra');
    expect(await svc.listar('wuarikes')).toHaveLength(1);
  });

  it('no deja sin gerente activo', async () => {
    const g = await svc.entrar(usuario('u1'));
    await expect(
      svc.actualizar('wuarikes', g.id, { rol: 'comercial' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.actualizar('wuarikes', g.id, { estado: 'inactivo' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('con otro gerente activo sí puede dejar de ser gerente', async () => {
    const g = await svc.entrar(usuario('u1'));
    const c = await svc.entrar(usuario('u2'));
    await svc.actualizar('wuarikes', c.id, {
      rol: 'gerente',
      estado: 'activo',
    });
    expect(
      await svc.actualizar('wuarikes', g.id, { rol: 'comercial' }),
    ).toMatchObject({ rol: 'comercial' });
  });

  it('entrar con una lectura vieja no revierte una desactivación', async () => {
    await svc.entrar(usuario('u1'));
    const ana = await svc.entrar(usuario('u2', 'wuarikes', 'Ana'));
    await svc.actualizar('wuarikes', ana.id, { estado: 'activo' });
    const vieja = await db
      .getRepository(Miembro)
      .findOneByOrFail({ id: ana.id });
    await svc.actualizar('wuarikes', ana.id, { estado: 'inactivo' });

    // Simula la carrera: entrar leyó antes de la desactivación y además trae un nombre nuevo.
    const repo = (svc as any).repo;
    jest.spyOn(repo, 'findOneBy').mockResolvedValueOnce(vieja);
    await svc.entrar(usuario('u2', 'wuarikes', 'Ana María'));

    const final = await db
      .getRepository(Miembro)
      .findOneByOrFail({ id: ana.id });
    expect(final).toMatchObject({ estado: 'inactivo', nombre: 'Ana María' });
  });

  it('aislamiento entre empresas', async () => {
    const a = await svc.entrar(usuario('u1', 'wuarikes'));
    await svc.entrar(usuario('u9', 'tendy'));
    await expect(
      svc.actualizar('tendy', a.id, { recibeDemos: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
