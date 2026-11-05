import { Injectable } from '@nestjs/common';
import { filter, map, Observable, Subject } from 'rxjs';
import type { Lead } from '../leads/lead.entity';
import type { Pregunta } from '../conocimiento/pregunta.entity';
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
  | { tipo: 'pregunta'; pregunta: Pregunta };

export type EventoConEmpresa = { tenant: string; evento: EventoBandeja };

// ponytail: en memoria, un solo proceso; Redis pub/sub si ARM corre en más de una instancia.
@Injectable()
export class EventosService {
  private readonly bus = new Subject<EventoConEmpresa>();

  emitir(tenant: string, evento: EventoBandeja): void {
    this.bus.next({ tenant, evento });
  }

  deEmpresa(tenant: string): Observable<EventoBandeja> {
    return this.bus.pipe(
      filter((e) => e.tenant === tenant),
      map((e) => e.evento),
    );
  }

  /** Todos los eventos, para procesos internos (por ejemplo, encolar al agente). */
  todos(): Observable<EventoConEmpresa> {
    return this.bus.asObservable();
  }
}
