import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { concatMap, filter, from, map, Observable, of, Subject } from 'rxjs';
import type { Lead } from '../leads/lead.entity';
import type { Pregunta } from '../conocimiento/pregunta.entity';
import type { Alerta } from '../alertas/alerta.entity';
import { ModoConversacion } from './conversacion.entity';
import { Mensaje } from './mensaje.entity';

export type EventoBandeja =
  | { tipo: 'mensaje'; conversacionId: string; mensaje: Mensaje }
  | {
      tipo: 'conversacion';
      conversacionId: string;
      modo: ModoConversacion;
      borrador: string | null;
    }
  | { tipo: 'lead'; conversacionId: string; lead: Lead }
  | { tipo: 'pregunta'; pregunta: Pregunta }
  /** Solo llega al miembro destinatario (se filtra en el SSE). */
  | { tipo: 'alerta'; miembroId: string; alerta: Alerta };

/**
 * Lo que un miembro puede recibir: sus alertas y, si es comercial, solo los chats que puede ver.
 * ponytail: una consulta por evento y comercial conectado; con mucho tráfico, llevar el dueño en el evento.
 */
export function visiblesPara(
  m: { id: string; rol: string },
  puedeVer: (conversacionId: string) => Promise<boolean>,
) {
  return (fuente: Observable<EventoBandeja>): Observable<EventoBandeja> =>
    fuente.pipe(
      concatMap((e) => {
        if (e.tipo === 'alerta') return of(e.miembroId === m.id ? [e] : []);
        if (m.rol === 'gerente' || !('conversacionId' in e)) return of([e]);
        return from(puedeVer(e.conversacionId).then((ok) => (ok ? [e] : [])));
      }),
      concatMap((l) => l),
    );
}

export type EventoConEmpresa = { tenant: string; evento: EventoBandeja };

const CANAL = 'arm:eventos';

/**
 * Bus de eventos. Con REDIS_URL el tiempo real (SSE) se reparte por Redis entre todas las instancias;
 * los procesos internos (encolar al agente, barrido) solo ven lo de su propia instancia para no repetir trabajo.
 */
@Injectable()
export class EventosService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(EventosService.name);
  private readonly interno = new Subject<EventoConEmpresa>();
  private readonly difusion = new Subject<EventoConEmpresa>();
  private pub?: Redis;
  private sub?: Redis;

  async onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url || process.env.EVENTOS_REDIS === 'off') return;
    this.pub = new Redis(url, { maxRetriesPerRequest: null });
    this.sub = this.pub.duplicate();
    this.sub.on('message', (_canal, m: string) =>
      this.difusion.next(JSON.parse(m) as EventoConEmpresa),
    );
    await this.sub.subscribe(CANAL);
  }

  async onModuleDestroy() {
    await Promise.all([this.sub?.quit(), this.pub?.quit()]);
  }

  emitir(tenant: string, evento: EventoBandeja): void {
    const e = { tenant, evento };
    this.interno.next(e);
    if (!this.pub) return this.difusion.next(e);
    this.pub
      .publish(CANAL, JSON.stringify(e))
      .catch((err: Error) =>
        this.log.error(`No se publicó el evento: ${err.message}`),
      );
  }

  deEmpresa(tenant: string): Observable<EventoBandeja> {
    return this.difusion.pipe(
      filter((e) => e.tenant === tenant),
      map((e) => e.evento),
    );
  }

  /** Eventos de esta instancia, para procesos internos (por ejemplo, encolar al agente). */
  todos(): Observable<EventoConEmpresa> {
    return this.interno.asObservable();
  }
}
