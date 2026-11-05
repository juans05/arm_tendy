import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { Miembro } from '../miembros/miembro.entity';
import { ActualizarLineaDto, GuardarLineaDto } from './dto/guardar-linea.dto';
import { LineaProducto } from './linea-producto.entity';

@Injectable()
export class LineasService {
  constructor(
    @InjectRepository(LineaProducto) private repo: Repository<LineaProducto>,
    @InjectRepository(Miembro) private miembros: Repository<Miembro>,
  ) {}

  listar(tenant: string): Promise<LineaProducto[]> {
    return this.repo.find({ where: { tenant }, relations: { comerciales: true }, order: { nombre: 'ASC' } });
  }

  async crear(tenant: string, dto: GuardarLineaDto): Promise<LineaProducto> {
    const { comercialIds, ...datos } = dto;
    const linea = this.repo.create({ ...datos, tenant, comerciales: await this.comercialesValidos(tenant, comercialIds ?? []) });
    return this.guardar(linea);
  }

  async actualizar(tenant: string, id: string, dto: ActualizarLineaDto): Promise<LineaProducto> {
    const linea = await this.obtener(tenant, id);
    const { comercialIds, ...datos } = dto;
    Object.assign(linea, datos);
    if (comercialIds) linea.comerciales = await this.comercialesValidos(tenant, comercialIds);
    return this.guardar(linea);
  }

  // Quiénes hacen las demos de la línea: los asignados o, si no hay, todos los activos que reciben demos.
  async comercialesDeLinea(tenant: string, lineaId: string): Promise<Miembro[]> {
    const linea = await this.obtener(tenant, lineaId);
    if (linea.comerciales.length) return linea.comerciales;
    return this.miembros.find({ where: { tenant, estado: 'activo', recibeDemos: true }, order: { createdAt: 'ASC' } });
  }

  private async obtener(tenant: string, id: string): Promise<LineaProducto> {
    const linea = await this.repo.findOne({ where: { tenant, id }, relations: { comerciales: true } });
    if (!linea) throw new NotFoundException('Línea no encontrada');
    return linea;
  }

  private async comercialesValidos(tenant: string, ids: string[]): Promise<Miembro[]> {
    const unicos = [...new Set(ids)];
    if (!unicos.length) return [];
    const encontrados = await this.miembros.findBy({ tenant, id: In(unicos) });
    if (encontrados.length !== unicos.length) throw new BadRequestException('Algún comercial no pertenece a la empresa');
    return encontrados;
  }

  private async guardar(linea: LineaProducto): Promise<LineaProducto> {
    try {
      return await this.repo.save(linea);
    } catch (e) {
      if (e instanceof QueryFailedError && (e as any).code === '23505') throw new ConflictException('Ya existe una línea con ese nombre');
      throw e;
    }
  }
}
