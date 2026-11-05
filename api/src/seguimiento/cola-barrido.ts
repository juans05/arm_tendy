import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { Subscription } from 'rxjs';
import { conexionRedis } from '../agente/cola-agente';
import { AgenteService } from '../agente/agente.service';
import { EventosService } from '../bandeja/eventos.service';
import { SeguimientoService } from './seguimiento.service';

/**
 * Corre el barrido cada minuto con un job programado de BullMQ: aunque haya varias instancias de la API,
 * cada minuto lo ejecuta una sola. Sin Redis no hay barrido (ni recordatorios ni alertas de tiempo).
 */
@Injectable()
export class ColaBarrido implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ColaBarrido.name);
  private cola?: Queue;
  private worker?: Worker;
  private sub?: Subscription;

  constructor(
    private readonly seg: SeguimientoService,
    private readonly eventos: EventosService,
    private readonly agente: AgenteService,
  ) {}

  async onModuleInit() {
    this.agente.ganchos.alPedirBaja = (conv) => this.seg.pedirBaja(conv);
    // Si el cliente vuelve a escribir, se corta su seguimiento.
    this.sub = this.eventos.todos().subscribe(({ evento }) => {
      if (evento.tipo === 'mensaje' && evento.mensaje.origen === 'cliente')
        this.seg
          .clienteRespondio(evento.conversacionId)
          .catch((e: Error) => this.log.error(e.message));
    });

    const url = process.env.REDIS_URL;
    if (!url || process.env.BARRIDO === 'off') return;
    const connection = conexionRedis(url);
    this.cola = new Queue('barrido', { connection });
    await this.cola.upsertJobScheduler(
      'cada-minuto',
      { every: 60_000 },
      { name: 'barrer', opts: { removeOnComplete: true, removeOnFail: true } },
    );
    this.worker = new Worker('barrido', () => this.seg.barrer(), {
      connection,
      concurrency: 1,
    });
    this.worker.on('failed', (_j, e) =>
      this.log.error(`Barrido falló: ${e.message}`),
    );
  }

  async onModuleDestroy() {
    this.sub?.unsubscribe();
    await this.worker?.close();
    await this.cola?.close();
  }
}
