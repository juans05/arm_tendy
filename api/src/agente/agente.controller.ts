import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Conversacion } from '../bandeja/conversacion.entity';
import { EventosService } from '../bandeja/eventos.service';
import { Mensaje } from '../bandeja/mensaje.entity';
import { EjecucionIa } from '../ia/ejecucion-ia.entity';
import { IaService } from '../ia/ia.service';
import { Lead } from '../leads/lead.entity';
import { Miembro } from '../miembros/miembro.entity';
import { MiembroActual, Roles } from '../miembros/miembros.decorators';
import { ColaAgente } from './cola-agente';
import { ConfigAgenteDto } from './dto/config.dto';
import { configPorDefecto, EmpresaConfig } from './empresa-config.entity';

@Controller()
export class AgenteController {
  constructor(
    private readonly db: DataSource,
    private readonly ia: IaService,
    private readonly cola: ColaAgente,
    private readonly eventos: EventosService,
  ) {}

  @Get('agente/config')
  async config(@MiembroActual() m: Miembro) {
    const c =
      (await this.db
        .getRepository(EmpresaConfig)
        .findOneBy({ tenant: m.tenant })) ?? configPorDefecto(m.tenant);
    return { ...c, iaActiva: this.ia.activa() };
  }

  @Put('agente/config')
  @Roles('gerente')
  async guardar(@MiembroActual() m: Miembro, @Body() dto: ConfigAgenteDto) {
    const repo = this.db.getRepository(EmpresaConfig);
    const actual =
      (await repo.findOneBy({ tenant: m.tenant })) ??
      configPorDefecto(m.tenant);
    return repo.save({ ...actual, ...dto, tenant: m.tenant });
  }

  @Get('conversaciones/:id/lead')
  async lead(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const lead = await this.db
      .getRepository(Lead)
      .findOneBy({ tenant: m.tenant, conversacionId: id });
    if (!lead) throw new NotFoundException('Lead no encontrado');
    return lead;
  }

  /** Pestaña "Agente": qué hizo la IA en esta conversación y con qué costo. */
  @Get('conversaciones/:id/ejecuciones')
  ejecuciones(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.db.getRepository(EjecucionIa).find({
      where: { tenant: m.tenant, conversacionId: id },
      order: { createdAt: 'DESC' },
      take: 30,
    });
  }

  /** El comercial devuelve la conversación a la IA; si el cliente espera respuesta, la IA la retoma. */
  @Post('conversaciones/:id/devolver-ia')
  async devolver(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const r = await this.db
      .getRepository(Conversacion)
      .update({ id, tenant: m.tenant }, { modo: 'ia', borrador: null });
    if (!r.affected) throw new NotFoundException('Conversación no encontrada');
    this.eventos.emitir(m.tenant, {
      tipo: 'conversacion',
      conversacionId: id,
      modo: 'ia',
      borrador: null,
    });
    const [ultimo] = await this.db.getRepository(Mensaje).find({
      where: { conversacionId: id },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    if (ultimo?.direccion === 'entrante') await this.cola.encolar(id);
    return { ok: true };
  }
}
