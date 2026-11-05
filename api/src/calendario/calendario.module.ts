import { Module, OnModuleInit } from '@nestjs/common';
import { AgenteModule } from '../agente/agente.module';
import { AgenteService } from '../agente/agente.service';
import { AlertasModule } from '../alertas/alertas.module';
import { Etapa } from '../leads/lead.entity';
import { LeadsModule } from '../leads/leads.module';
import { CalendarioController } from './calendario.controller';
import { CalendarioService } from './calendario.service';

const OFRECE_EN: Etapa[] = ['nuevo', 'en_conversacion', 'seguimiento'];

@Module({
  imports: [AgenteModule, AlertasModule, LeadsModule],
  controllers: [CalendarioController],
  providers: [CalendarioService],
  exports: [CalendarioService],
})
export class CalendarioModule implements OnModuleInit {
  constructor(
    private readonly agente: AgenteService,
    private readonly cal: CalendarioService,
  ) {}

  // La IA ofrece horarios reales y reserva el elegido; nunca inventa horarios.
  onModuleInit() {
    this.agente.ganchos.horarios = async (conv, lead) => {
      if (!OFRECE_EN.includes(lead.etapa)) return undefined;
      const h = await this.cal.ofrecer(conv, lead);
      return h.length ? h : undefined;
    };
    this.agente.ganchos.alElegirHorario = (conv, lead, h) =>
      this.cal.elegir(conv, lead, h);
  }
}
