import { Injectable } from '@nestjs/common';
import { filter, map, Observable, Subject } from 'rxjs';
import { Mensaje } from './mensaje.entity';

export type EventoBandeja = {
  tipo: 'mensaje';
  conversacionId: string;
  mensaje: Mensaje;
};

// ponytail: en memoria, un solo proceso; Redis pub/sub si ARM corre en más de una instancia.
@Injectable()
export class EventosService {
  private readonly bus = new Subject<{
    tenant: string;
    evento: EventoBandeja;
  }>();

  emitir(tenant: string, evento: EventoBandeja): void {
    this.bus.next({ tenant, evento });
  }

  deEmpresa(tenant: string): Observable<EventoBandeja> {
    return this.bus.pipe(
      filter((e) => e.tenant === tenant),
      map((e) => e.evento),
    );
  }
}
