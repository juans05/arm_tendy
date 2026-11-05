import { MessageEvent } from '@nestjs/common';
import {
  EMPTY,
  filter,
  from,
  interval,
  map,
  merge,
  Observable,
  switchMap,
  takeUntil,
  timer,
} from 'rxjs';

type Opciones = {
  /** Vencimiento del token (ms epoch). */
  venceEn: number | undefined;
  /** Se consulta cada `revisarCadaMs`; si devuelve false se corta el flujo. */
  sigueActivo: () => Promise<boolean>;
  revisarCadaMs: number;
  /** Latido con nombre propio (el navegador lo ignora en onmessage) para que proxies no cierren la conexión. */
  latidoCadaMs: number;
};

// Los guards solo corren al conectar: este flujo se corta solo cuando vence el token o desactivan al miembro.
export function flujoDeSesion<T>(
  eventos: Observable<T>,
  o: Opciones,
): Observable<MessageEvent> {
  const vence =
    o.venceEn === undefined
      ? EMPTY
      : timer(Math.max(0, o.venceEn - Date.now()));
  const baja = interval(o.revisarCadaMs).pipe(
    switchMap(() => from(o.sigueActivo())),
    filter((activo) => !activo),
  );
  return merge(
    eventos.pipe(map((data): MessageEvent => ({ data: data as object }))),
    interval(o.latidoCadaMs).pipe(
      map((): MessageEvent => ({ type: 'ping', data: '' })),
    ),
  ).pipe(takeUntil(merge(vence, baja)));
}
