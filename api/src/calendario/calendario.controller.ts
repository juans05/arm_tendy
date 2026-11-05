import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Miembro } from '../miembros/miembro.entity';
import { MiembroActual } from '../miembros/miembros.decorators';
import { CalendarioService } from './calendario.service';
import {
  BloqueoDto,
  EstadoCitaDto,
  HorariosDto,
  NuevaCitaDto,
  RangoDto,
  ReprogramarDto,
} from './dto/calendario.dto';

@Controller()
export class CalendarioController {
  constructor(private readonly cal: CalendarioService) {}

  @Get('citas')
  citas(@MiembroActual() m: Miembro, @Query() r: RangoDto) {
    return this.cal.listarCitas(m, new Date(r.desde), new Date(r.hasta));
  }

  @Post('citas')
  crear(@MiembroActual() m: Miembro, @Body() dto: NuevaCitaDto) {
    return this.cal.crearCita(m, dto);
  }

  @Patch('citas/:id')
  reprogramar(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReprogramarDto,
  ) {
    return this.cal.reprogramar(m, id, dto.inicio, dto.fin);
  }

  @Post('citas/:id/estado')
  estado(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EstadoCitaDto,
  ) {
    return this.cal.cambiarEstado(m, id, dto.estado);
  }

  @Get('miembros/:id/horarios')
  horarios(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cal.horarios(m, id);
  }

  @Put('miembros/:id/horarios')
  guardarHorarios(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HorariosDto,
  ) {
    return this.cal.guardarHorarios(m, id, dto.franjas);
  }

  @Get('bloqueos')
  bloqueos(@MiembroActual() m: Miembro, @Query() r: RangoDto) {
    return this.cal.bloqueos(m, new Date(r.desde), new Date(r.hasta));
  }

  @Post('bloqueos')
  crearBloqueo(@MiembroActual() m: Miembro, @Body() dto: BloqueoDto) {
    return this.cal.crearBloqueo(m, dto);
  }

  @Delete('bloqueos/:id')
  async borrarBloqueo(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.cal.borrarBloqueo(m, id);
    return { ok: true };
  }
}
