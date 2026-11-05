import { Module } from '@nestjs/common';
import { CanalesModule } from '../canales/canales.module';
import { WebhookController } from '../canales/webhook.controller';
import { EntrantesService } from './entrantes.service';
import { EventosService } from './eventos.service';

// El webhook vive en canales/ (frontera con Meta) pero se registra aquí para no crear una dependencia circular.
@Module({
  imports: [CanalesModule],
  controllers: [WebhookController],
  providers: [EntrantesService, EventosService],
})
export class BandejaModule {}
