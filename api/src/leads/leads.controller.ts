import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { Miembro } from '../miembros/miembro.entity';
import { MiembroActual } from '../miembros/miembros.decorators';
import { FiltroTablaDto } from '../actividad/dto/actividad.dto';
import { ActualizarLeadDto, FiltroLeadsDto } from './dto/actualizar-lead.dto';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  listar(@MiembroActual() m: Miembro, @Query() f: FiltroLeadsDto) {
    return this.leads.listar(m, f);
  }

  @Get('tabla')
  tabla(@MiembroActual() m: Miembro, @Query() f: FiltroTablaDto) {
    return this.leads.tabla(m, f);
  }

  @Get(':id')
  uno(@MiembroActual() m: Miembro, @Param('id', ParseUUIDPipe) id: string) {
    return this.leads.conContacto(m, id);
  }

  @Get(':id/historial')
  historial(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leads.historial(m, id);
  }

  @Patch(':id')
  actualizar(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarLeadDto,
  ) {
    return this.leads.actualizar(m, id, dto);
  }
}
