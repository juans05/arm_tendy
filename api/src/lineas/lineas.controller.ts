import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Miembro } from '../miembros/miembro.entity';
import { MiembroActual, Roles } from '../miembros/miembros.decorators';
import { ActualizarLineaDto, GuardarLineaDto } from './dto/guardar-linea.dto';
import { LineasService } from './lineas.service';

@Controller('lineas')
export class LineasController {
  constructor(private lineas: LineasService) {}

  @Get()
  listar(@MiembroActual() yo: Miembro) {
    return this.lineas.listar(yo.tenant);
  }

  @Post()
  @Roles('gerente')
  crear(@MiembroActual() yo: Miembro, @Body() dto: GuardarLineaDto) {
    return this.lineas.crear(yo.tenant, dto);
  }

  @Patch(':id')
  @Roles('gerente')
  actualizar(
    @MiembroActual() yo: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarLineaDto,
  ) {
    return this.lineas.actualizar(yo.tenant, id, dto);
  }
}
