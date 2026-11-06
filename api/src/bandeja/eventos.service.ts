import { Injectable } from '@nestjs/common';
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
