import { Module } from '@nestjs/common';
import { ActividadModule } from '../actividad/actividad.module';
import { AgenteModule } from '../agente/agente.module';
import { AlertasModule } from '../alertas/alertas.module';
import { BandejaModule } from '../bandeja/bandeja.module';
import { CanalesModule } from '../canales/canales.module';
import { ColaBarrido } from './cola-barrido';
import { PlantillasService } from './plantillas.service';
import { SeguimientoController } from './seguimiento.controller';
import { SeguimientoService } from './seguimiento.service';

@Module({
  imports: [
    ActividadModule,
    AgenteModule,
    AlertasModule,
    BandejaModule,
    CanalesModule,
  ],
  controllers: [SeguimientoController],
  providers: [SeguimientoService, PlantillasService, ColaBarrido],
})
export class SeguimientoModule {}
