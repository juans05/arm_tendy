import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CanalesController } from './canales.controller';
import { ConexionWhatsappService } from './conexion-whatsapp.service';
import { EnvioWhatsappService } from './envio-whatsapp.service';
import { MediaWhatsappService } from './media-whatsapp.service';
import { MetaGraph } from './meta-graph.client';
import { NumeroWhatsapp } from './numero-whatsapp.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NumeroWhatsapp])],
  controllers: [CanalesController],
  providers: [
    ConexionWhatsappService,
    EnvioWhatsappService,
    MediaWhatsappService,
    MetaGraph,
  ],
  exports: [
    ConexionWhatsappService,
    EnvioWhatsappService,
    MediaWhatsappService,
    MetaGraph,
  ],
})
export class CanalesModule {}
