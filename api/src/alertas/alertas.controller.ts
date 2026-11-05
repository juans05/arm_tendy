import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';
import { DataSource } from 'typeorm';
import { Miembro } from '../miembros/miembro.entity';
import { MiembroActual } from '../miembros/miembros.decorators';
import { AlertasService } from './alertas.service';

class PreferenciasDto {
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) alertasOff: string[];
}

@Controller('alertas')
export class AlertasController {
  constructor(
    private readonly alertas: AlertasService,
    private readonly db: DataSource,
  ) {}

  @Get()
  listar(@MiembroActual() m: Miembro) {
    return this.alertas.listar(m);
  }

  @Post('leidas')
  async leidas(@MiembroActual() m: Miembro) {
    await this.alertas.marcarLeidas(m);
    return { ok: true };
  }

  /** Cada miembro elige qué alertas no quiere recibir. */
  @Get('preferencias')
  preferencias(@MiembroActual() m: Miembro) {
    return { alertasOff: m.alertasOff };
  }

  @Put('preferencias')
  async guardar(@MiembroActual() m: Miembro, @Body() dto: PreferenciasDto) {
    await this.db
      .getRepository(Miembro)
      .update({ id: m.id }, { alertasOff: dto.alertasOff });
    return { alertasOff: dto.alertasOff };
  }
}
