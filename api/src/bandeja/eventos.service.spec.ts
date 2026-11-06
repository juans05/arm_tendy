import { firstValueFrom, Observable, of, toArray } from 'rxjs';
import { EventoBandeja, visiblesPara } from './eventos.service';

describe('visiblesPara', () => {
  const eventos = () =>
    of(
      { tipo: 'mensaje', conversacionId: 'mia' },
      { tipo: 'mensaje', conversacionId: 'ajena' },
      { tipo: 'lead', conversacionId: 'ajena' },
      { tipo: 'conversacion', conversacionId: 'ajena' },
      { tipo: 'alerta', miembroId: 'yo' },
      { tipo: 'alerta', miembroId: 'otro' },
      { tipo: 'pregunta' },
    ) as unknown as Observable<EventoBandeja>;
  const resumen = (r: EventoBandeja[]) =>
    r.map((e) =>
      [
        e.tipo,
        'conversacionId' in e
          ? e.conversacionId
          : 'miembroId' in e
            ? e.miembroId
            : '',
      ].join(':'),
    );

  it('a un comercial solo le llegan los chats que puede ver y sus alertas', async () => {
    const r = await firstValueFrom(
      eventos().pipe(
        visiblesPara(
          { id: 'yo', rol: 'comercial' },
          async (id) => id === 'mia',
        ),
        toArray(),
      ),
    );
    expect(resumen(r)).toEqual(['mensaje:mia', 'alerta:yo', 'pregunta:']);
  });

  it('al gerente le llega todo menos las alertas de otros', async () => {
    const r = await firstValueFrom(
      eventos().pipe(
        visiblesPara({ id: 'yo', rol: 'gerente' }, async () => false),
        toArray(),
      ),
    );
    expect(r).toHaveLength(6);
  });
});
