import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Miembro } from '../miembros/miembro.entity';
import { MiembroActual } from '../miembros/miembros.decorators';
import { EnviarPlantillaDto } from './dto/plantilla.dto';
import { PlantillasService } from './plantillas.service';

@Controller()
export class SeguimientoController {
  constructor(private readonly plantillas: PlantillasService) {}

  @Get('conversaciones/:id/plantillas')
  listar(@MiembroActual() m: Miembro, @Param('id', ParseUUIDPipe) id: string) {
    return this.plantillas.listar(m, id);
  }

  @Post('conversaciones/:id/plantilla')
  enviar(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnviarPlantillaDto,
  ) {
    return this.plantillas.enviar(
      m,
      id,
      dto.nombre,
      dto.idioma,
      dto.parametros,
    );
  }
}
