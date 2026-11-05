import { Module } from '@nestjs/common';
import { BandejaModule } from '../bandeja/bandeja.module';
import { CanalesModule } from '../canales/canales.module';
import { AlertasController } from './alertas.controller';
import { AlertasService } from './alertas.service';

@Module({
  imports: [BandejaModule, CanalesModule],
  controllers: [AlertasController],
  providers: [AlertasService],
  exports: [AlertasService],
})
export class AlertasModule {}
