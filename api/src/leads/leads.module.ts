import { Module, OnModuleInit } from '@nestjs/common';
import { AgenteModule } from '../agente/agente.module';
import { AgenteService } from '../agente/agente.service';
import { AlertasModule } from '../alertas/alertas.module';
import { BandejaModule } from '../bandeja/bandeja.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [AgenteModule, AlertasModule, BandejaModule],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule implements OnModuleInit {
  constructor(
    private readonly agente: AgenteService,
    private readonly leads: LeadsService,
  ) {}

  // Cuando la IA pasa la conversación a una persona, se asigna un comercial y se le avisa.
  onModuleInit() {
    this.agente.ganchos.alPasarAHumano = (conv, motivo) =>
      this.leads.asignarAlTraspaso(conv, motivo);
  }
}
