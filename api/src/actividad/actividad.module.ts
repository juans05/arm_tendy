import { Module } from '@nestjs/common';
import { AlertasModule } from '../alertas/alertas.module';
import { LeadsModule } from '../leads/leads.module';
import { ActividadController } from './actividad.controller';
import { ActividadService } from './actividad.service';

@Module({
  imports: [LeadsModule, AlertasModule],
  controllers: [ActividadController],
  providers: [ActividadService],
  exports: [ActividadService],
})
export class ActividadModule {}
