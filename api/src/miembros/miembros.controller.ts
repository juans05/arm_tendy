import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ActualizarMiembroDto } from './dto/actualizar-miembro.dto';
import { Miembro } from './miembro.entity';
import { MiembroActual, PermitirPendiente, Roles } from './miembros.decorators';
import { MiembrosService } from './miembros.service';

@Controller()
export class MiembrosController {
  constructor(private miembros: MiembrosService) {}

  @Get('me')
  @PermitirPendiente()
  me(@MiembroActual() miembro: Miembro) {
    return { miembro, empresa: miembro.tenant };
  }

  @Get('miembros')
  @Roles('gerente')
  listar(@MiembroActual() yo: Miembro) {
    return this.miembros.listar(yo.tenant);
  }

  @Patch('miembros/:id')
  @Roles('gerente')
  actualizar(
    @MiembroActual() yo: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarMiembroDto,
  ) {
    return this.miembros.actualizar(yo.tenant, id, dto);
  }
}
