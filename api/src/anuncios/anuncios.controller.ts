import { Body, Controller, Delete, Get, Put } from '@nestjs/common';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { Miembro } from '../miembros/miembro.entity';
import { MiembroActual, Roles } from '../miembros/miembros.decorators';
import { AnunciosService } from './anuncios.service';

class ConectarCuentaDto {
  @Matches(/^(act_)?\d{1,30}$/, {
    message: 'ID de cuenta publicitaria inválido',
  })
  cuentaId: string;
  @IsString() @IsNotEmpty() @Length(1, 1000) token: string;
}

// Cuenta publicitaria de Meta: el token nunca se devuelve.
@Controller('anuncios/cuenta')
@Roles('gerente')
export class AnunciosController {
  constructor(private readonly anuncios: AnunciosService) {}

  @Get()
  async cuenta(@MiembroActual() m: Miembro) {
    return { cuenta: await this.anuncios.cuenta(m.tenant) };
  }

  @Put()
  async conectar(@MiembroActual() m: Miembro, @Body() dto: ConectarCuentaDto) {
    return {
      cuenta: await this.anuncios.conectar(m.tenant, dto.cuentaId, dto.token),
    };
  }

  @Delete()
  async desconectar(@MiembroActual() m: Miembro) {
    await this.anuncios.desconectar(m.tenant);
    return { cuenta: null };
  }
}
