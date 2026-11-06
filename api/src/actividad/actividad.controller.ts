import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Miembro } from '../miembros/miembro.entity';
import { MiembroActual } from '../miembros/miembros.decorators';
import { ActividadService } from './actividad.service';
import {
  CambioTareaDto,
  FiltroTareasDto,
  NotaDto,
  TareaDto,
  VistaDto,
} from './dto/actividad.dto';

@Controller()
export class ActividadController {
  constructor(private readonly actividad: ActividadService) {}

  @Get('leads/:id/actividad')
  lineaDeTiempo(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.actividad.lineaDeTiempo(m, id);
  }

  @Post('leads/:id/notas')
  nota(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NotaDto,
  ) {
    return this.actividad.crearNota(m, id, dto.texto);
  }

  @Delete('notas/:id')
  @HttpCode(204)
  borrarNota(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.actividad.borrarNota(m, id);
  }

  @Post('leads/:id/tareas')
  tarea(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TareaDto,
  ) {
    return this.actividad.crearTarea(m, id, dto);
  }

  @Get('tareas')
  tareas(@MiembroActual() m: Miembro, @Query() f: FiltroTareasDto) {
    return this.actividad.tareas(m, {
      estado: f.estado ?? 'pendiente',
      todas: f.todas,
    });
  }

  @Patch('tareas/:id')
  actualizarTarea(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CambioTareaDto,
  ) {
    return this.actividad.actualizarTarea(m, id, dto);
  }

  @Get('vistas')
  vistas(@MiembroActual() m: Miembro) {
    return this.actividad.vistas(m);
  }

  @Post('vistas')
  guardarVista(@MiembroActual() m: Miembro, @Body() dto: VistaDto) {
    return this.actividad.guardarVista(m, dto);
  }

  @Delete('vistas/:id')
  @HttpCode(204)
  borrarVista(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.actividad.borrarVista(m, id);
  }
}
