import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CanalesController } from './canales.controller';
import { ConexionWhatsappService } from './conexion-whatsapp.service';
import { MetaGraph } from './meta-graph.client';
import { NumeroWhatsapp } from './numero-whatsapp.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NumeroWhatsapp])],
  controllers: [CanalesController],
  providers: [ConexionWhatsappService, MetaGraph],
  exports: [ConexionWhatsappService, MetaGraph],
})
export class CanalesModule {}
