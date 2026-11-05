import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { DataSource } from 'typeorm';
import { CurrentUser } from '../auth/current-user.decorator';
import { SuiteUser } from '../auth/suite-user';
import { TokenEnQuery } from '../auth/token-en-query.decorator';
import { Miembro } from '../miembros/miembro.entity';
import { MiembroActual } from '../miembros/miembros.decorators';
import { BandejaService } from './bandeja.service';
import { EnviarMensajeDto } from './dto/enviar-mensaje.dto';
import { EventosService } from './eventos.service';
import { flujoDeSesion } from './sesion-sse';

@Controller()
export class BandejaController {
  constructor(
    private readonly bandeja: BandejaService,
    private readonly eventos: EventosService,
    private readonly db: DataSource,
  ) {}

  @Get('conversaciones')
  listar(@MiembroActual() m: Miembro) {
    return this.bandeja.listar(m.tenant);
  }

  @Get('conversaciones/:id/mensajes')
  mensajes(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bandeja.mensajes(m.tenant, id);
  }

  @Post('conversaciones/:id/mensajes')
  responder(
    @MiembroActual() m: Miembro,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnviarMensajeDto,
  ) {
    return this.bandeja.responder(m.tenant, id, m, dto.texto);
  }

  // Tiempo real de la bandeja: solo eventos de la empresa del miembro.
  @Sse('eventos')
  @TokenEnQuery()
  eventosSse(
    @MiembroActual() m: Miembro,
    @CurrentUser() u: SuiteUser,
  ): Observable<MessageEvent> {
    return flujoDeSesion(this.eventos.deEmpresa(m.tenant), {
      venceEn: u.exp ? u.exp * 1000 : undefined,
      sigueActivo: () =>
        this.db
          .getRepository(Miembro)
          .exists({ where: { id: m.id, estado: 'activo' } }),
      revisarCadaMs: Number(process.env.SSE_REVISAR_MS ?? 60_000),
      latidoCadaMs: 25_000,
    });
  }
}
