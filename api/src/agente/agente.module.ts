import { Module } from '@nestjs/common';
import { BandejaModule } from '../bandeja/bandeja.module';
import { CanalesModule } from '../canales/canales.module';
import { ConocimientoModule } from '../conocimiento/conocimiento.module';
import { AgenteController } from './agente.controller';
import { AgenteService } from './agente.service';
import { ColaAgente } from './cola-agente';

@Module({
  imports: [BandejaModule, CanalesModule, ConocimientoModule],
  controllers: [AgenteController],
  providers: [AgenteService, ColaAgente],
  exports: [AgenteService, ColaAgente],
})
export class AgenteModule {}
