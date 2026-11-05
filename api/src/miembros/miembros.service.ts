import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { SuiteUser } from '../auth/suite-user';
import { ActualizarMiembroDto } from './dto/actualizar-miembro.dto';
import { Miembro } from './miembro.entity';

@Injectable()
export class MiembrosService {
  constructor(
    @InjectDataSource() private db: DataSource,
    @InjectRepository(Miembro) private repo: Repository<Miembro>,
  ) {}

  // Serializa los cambios de miembros de una empresa: sin esto, dos primeros ingresos simultáneos serían ambos gerentes.
  private bloquearEmpresa(m: EntityManager, tenant: string) {
    return m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [tenant]);
  }

  async entrar(user: SuiteUser): Promise<Miembro> {
    const existente = await this.repo.findOneBy({
      tenant: user.tenant,
      userId: user.userId,
    });
    if (existente) {
      if (
        existente.nombre === user.nombre &&
        existente.username === user.username
      )
        return existente;
      // update parcial: un save con la copia leída podría revertir un rol/estado cambiado entre la lectura y la escritura.
      await this.repo.update(
        { id: existente.id },
        { nombre: user.nombre, username: user.username },
      );
      return this.repo.findOneByOrFail({ id: existente.id });
    }

    return this.db.transaction(async (m) => {
      await this.bloquearEmpresa(m, user.tenant);
      const repo = m.getRepository(Miembro);
      const yaCreado = await repo.findOneBy({
        tenant: user.tenant,
        userId: user.userId,
      });
      if (yaCreado) return yaCreado;
      const primero = (await repo.countBy({ tenant: user.tenant })) === 0;
      return repo.save(
        repo.create({
          tenant: user.tenant,
          userId: user.userId,
          username: user.username,
          nombre: user.nombre,
          rol: primero ? 'gerente' : 'comercial',
          estado: primero ? 'activo' : 'pendiente',
          celularAlertas: null,
          recibeDemos: false,
        }),
      );
    });
  }

  listar(tenant: string): Promise<Miembro[]> {
    return this.repo.find({ where: { tenant }, order: { createdAt: 'ASC' } });
  }

  async actualizar(
    tenant: string,
    id: string,
    dto: ActualizarMiembroDto,
  ): Promise<Miembro> {
    return this.db.transaction(async (m) => {
      await this.bloquearEmpresa(m, tenant);
      const repo = m.getRepository(Miembro);
      const actual = await repo.findOneBy({ tenant, id });
      if (!actual) throw new NotFoundException('Miembro no encontrado');

      const nuevo = { ...actual, ...dto };
      const eraGerenteActivo =
        actual.rol === 'gerente' && actual.estado === 'activo';
      const sigueGerenteActivo =
        nuevo.rol === 'gerente' && nuevo.estado === 'activo';
      if (eraGerenteActivo && !sigueGerenteActivo) {
        const gerentesActivos = await repo.countBy({
          tenant,
          rol: 'gerente',
          estado: 'activo',
        });
        if (gerentesActivos <= 1)
          throw new BadRequestException(
            'La empresa debe tener al menos un gerente activo',
          );
      }
      return repo.save(nuevo);
    });
  }
}
