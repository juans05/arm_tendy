import { Body, Controller, Get, Post } from '@nestjs/common';
import { Miembro } from '../miembros/miembro.entity';
import { MiembroActual, Roles } from '../miembros/miembros.decorators';
import { ConexionWhatsappService } from './conexion-whatsapp.service';
import { ConectarDto, ConectarExistenteDto } from './dto/conectar.dto';

@Controller('canales')
export class CanalesController {
  constructor(private readonly conexion: ConexionWhatsappService) {}

  // Datos públicos para abrir el Embedded Signup de Facebook en la web.
  @Get('whatsapp/config')
  config() {
    const appId = process.env.META_APP_ID ?? '';
    const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID ?? '';
    return {
      configurado: !!(appId && configId),
      appId,
      configId,
      graphVersion: process.env.WHATSAPP_API_VERSION ?? 'v20.0',
    };
  }

  @Get()
  listar(@MiembroActual() m: Miembro) {
    return this.conexion.listar(m.tenant);
  }

  @Post('whatsapp/conectar')
  @Roles('gerente')
  conectar(@MiembroActual() m: Miembro, @Body() dto: ConectarDto) {
    return this.conexion.conectar(m.tenant, dto);
  }

  @Post('whatsapp/conectar-existente')
  @Roles('gerente')
  conectarExistente(
    @MiembroActual() m: Miembro,
    @Body() dto: ConectarExistenteDto,
  ) {
    return this.conexion.conectarExistente(m.tenant, dto);
  }
}
