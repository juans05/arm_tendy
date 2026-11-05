import { Module } from '@nestjs/common';
import { CanalesModule } from '../canales/canales.module';
import { WebhookController } from '../canales/webhook.controller';
import { BandejaController } from './bandeja.controller';
import { BandejaService } from './bandeja.service';
import { EntrantesService } from './entrantes.service';
import { EventosService } from './eventos.service';

// El webhook vive en canales/ (frontera con Meta) pero se registra aquí para no crear una dependencia circular.
@Module({
  imports: [CanalesModule],
  controllers: [WebhookController, BandejaController],
  providers: [EntrantesService, EventosService, BandejaService],
  exports: [EventosService, BandejaService],
})
export class BandejaModule {}
