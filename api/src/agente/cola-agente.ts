import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConnectionOptions, Queue, Worker } from 'bullmq';
import { Subscription } from 'rxjs';
import { EventosService } from '../bandeja/eventos.service';
import { IaService } from '../ia/ia.service';
import { AgenteService } from './agente.service';

export const conexionRedis = (url: string): ConnectionOptions => {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username || undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: Number(u.pathname.slice(1) || 0),
    ...(u.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
};

/**
 * Cada mensaje del cliente encola "atender esta conversación". El jobId por conversación junta varios mensajes
 * seguidos en una sola respuesta (espera AGENTE_ESPERA_MS) y los reintentos cubren caídas de la IA o de Meta.
 * Sin IA configurada o sin Redis no se crea nada: ARM funciona como bandeja humana.
 */
@Injectable()
export class ColaAgente implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ColaAgente.name);
  private cola?: Queue;
  private worker?: Worker;
  private sub?: Subscription;

  constructor(
    private readonly agente: AgenteService,
    private readonly ia: IaService,
    private readonly eventos: EventosService,
  ) {}

  onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!this.ia.activa() || !url || process.env.AGENTE_COLA === 'off') return;
    const connection = conexionRedis(url);
    this.cola = new Queue('agente', { connection });
    this.worker = new Worker(
      'agente',
      (job) => this.agente.atender(job.data.conversacionId as string),
      { connection, concurrency: 5 },
    );
    this.worker.on('failed', (job, e) =>
      this.log.error(
        `Agente falló en ${job?.data?.conversacionId}: ${e.message}`,
      ),
    );
    this.sub = this.eventos.todos().subscribe(({ evento }) => {
      if (evento.tipo === 'mensaje' && evento.mensaje.origen === 'cliente')
        void this.encolar(evento.conversacionId);
    });
  }

  async encolar(conversacionId: string): Promise<void> {
    if (!this.cola) return;
    try {
      await this.cola.add(
        'atender',
        { conversacionId },
        {
          jobId: `conv-${conversacionId}`,
          delay: Number(process.env.AGENTE_ESPERA_MS ?? 3000),
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      );
    } catch (e) {
      this.log.error(
        `No se pudo encolar ${conversacionId}: ${(e as Error).message}`,
      );
    }
  }

  async onModuleDestroy() {
    this.sub?.unsubscribe();
    await this.worker?.close();
    await this.cola?.close();
  }
}
