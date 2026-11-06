import { DataSource } from 'typeorm';
import { limpiarBase } from '../../test/util/app';
import { crearDbTest } from '../../test/util/db';
import { crearNumero, payloadTexto } from '../../test/util/whatsapp';
import { EntrantesService } from '../bandeja/entrantes.service';
import { EventosService } from '../bandeja/eventos.service';
import { MetaError, MetaGraph } from '../canales/meta-graph.client';
import { LeadHistorial } from '../leads/lead-historial.entity';
import { Lead } from '../leads/lead.entity';
import { AnunciosService } from './anuncios.service';

const DIA = 24 * 3600_000;

describe('AnunciosService', () => {
  let db: DataSource;
  let svc: AnunciosService;
  let llamadas: {
    ruta: string;
    query?: Record<string, string>;
    token?: string;
  }[];
  let respuestas: ((ruta: string, q: Record<string, string>) => unknown)[];

  beforeAll(async () => (db = await crearDbTest()));
  afterAll(() => db.destroy());

  beforeEach(async () => {
    await limpiarBase(db);
    await db.query('DELETE FROM cuentas_anuncios');
    llamadas = [];
    respuestas = [];
    const meta = {
      async llamar(
        _m: string,
        ruta: string,
        o: { query?: Record<string, string>; token?: string },
      ) {
        llamadas.push({ ruta, query: o.query, token: o.token });
        const r = respuestas.shift();
        if (!r) throw new Error('llamada inesperada a ' + ruta);
        const v = r(ruta, o.query ?? {});
        if (v instanceof Error) throw v;
        return v;
      },
    } as unknown as MetaGraph;
    svc = new AnunciosService(db, meta);
    await crearNumero(db, 't', 'ph1');
  });

  const conectar = async () => {
    respuestas.push(() => ({ name: 'Wuarikes Ads', currency: 'PEN' }));
    return svc.conectar('t', 'act_123', 'tok-ads');
  };

  it('conecta la cuenta validándola con Meta y guarda el token cifrado', async () => {
    expect(await conectar()).toEqual({
      cuentaId: '123',
      nombre: 'Wuarikes Ads',
      moneda: 'PEN',
    });
    expect(llamadas[0]).toMatchObject({ ruta: '/act_123', token: 'tok-ads' });
    expect(await svc.cuenta('t')).toEqual({
      cuentaId: '123',
      nombre: 'Wuarikes Ads',
      moneda: 'PEN',
    });
    const [fila] = await db.query('SELECT token FROM cuentas_anuncios');
    expect(fila.token).not.toContain('tok-ads');
    expect(await svc.cuenta('otra')).toBeNull();
  });

  it('si Meta rechaza el token no guarda nada', async () => {
    respuestas.push(() => new MetaError('Invalid OAuth access token'));
    await expect(svc.conectar('t', '123', 'malo')).rejects.toThrow(
      /^Meta no aceptó la cuenta o el token: .*Invalid OAuth access token/,
    );
    expect(await svc.cuenta('t')).toBeNull();
  });

  it('cruza el gasto de cada anuncio con sus leads, demos y ventas', async () => {
    await conectar();
    const lead = async (
      n: number,
      ad: string,
      etapas: Lead['etapa'][],
      monto?: number,
    ) => {
      await new EntrantesService(db, new EventosService()).procesar(
        payloadTexto('ph1', `wamid.a${n}`, 'Hola', `5197${n}`, {
          referral: {
            source_id: ad,
            source_type: 'ad',
            source_url: 'https://fb.me/x',
            headline: 'Promo',
          },
        }),
      );
      const l = await db
        .getRepository(Lead)
        .findOneOrFail({ where: { contacto: { telefono: `5197${n}` } } });
      let de: Lead['etapa'] = 'nuevo';
      for (const a of etapas) {
        await db
          .getRepository(LeadHistorial)
          .save({ tenant: 't', leadId: l.id, de, a });
        de = a;
      }
      await db
        .getRepository(Lead)
        .update(l.id, { etapa: de, monto: monto ?? null });
    };
    await lead(1, 'ad1', ['demo_agendada', 'ganado'], 900);
    await lead(2, 'ad1', ['demo_agendada']);
    await lead(3, 'ad1', []);
    await lead(4, 'ad2', []);

    respuestas.push((_r, q) => {
      expect(q.level).toBe('ad');
      return {
        data: [
          {
            ad_id: 'ad1',
            ad_name: 'Promo POS',
            campaign_name: 'Noviembre',
            spend: '300.00',
          },
        ],
        paging: {
          cursors: { after: 'c1' },
          next: 'https://graph.facebook.com/next',
        },
      };
    });
    respuestas.push((_r, q) => {
      expect(q.after).toBe('c1');
      return {
        data: [
          {
            ad_id: 'ad3',
            ad_name: 'Sin leads',
            campaign_name: 'Noviembre',
            spend: '100',
          },
        ],
      };
    });

    const ahora = Date.now();
    const r = await svc.resumen(
      't',
      new Date(ahora - DIA),
      new Date(ahora + DIA),
      'America/Lima',
    );
    expect(r).toMatchObject({
      moneda: 'PEN',
      gasto: 400,
      leads: 4,
      demos: 2,
      ventas: 1,
      ingresos: 900,
      costoPorLead: 100,
      costoPorDemo: 200,
      costoPorVenta: 400,
      retorno: 2.25,
    });
    expect(r && 'porAnuncio' in r && r.porAnuncio).toEqual([
      {
        adId: 'ad1',
        nombre: 'Promo POS',
        campana: 'Noviembre',
        gasto: 300,
        leads: 3,
        demos: 2,
        ventas: 1,
        ingresos: 900,
        costoPorLead: 100,
      },
      {
        adId: 'ad3',
        nombre: 'Sin leads',
        campana: 'Noviembre',
        gasto: 100,
        leads: 0,
        demos: 0,
        ventas: 0,
        ingresos: 0,
        costoPorLead: null,
      },
      {
        adId: 'ad2',
        nombre: null,
        campana: null,
        gasto: 0,
        leads: 1,
        demos: 0,
        ventas: 0,
        ingresos: 0,
        costoPorLead: 0,
      },
    ]);
  });

  it('sin cuenta conectada no hay resumen, y si Meta falla lo dice sin romper el panel', async () => {
    expect(
      await svc.resumen('t', new Date(), new Date(), 'America/Lima'),
    ).toBeNull();
    await conectar();
    respuestas.push(() => new MetaError('Token expirado'));
    expect(
      await svc.resumen('t', new Date(), new Date(), 'America/Lima'),
    ).toEqual({
      error: expect.stringMatching(
        /^No se pudo leer el gasto de Meta: .*Token expirado/,
      ) as string,
    });
  });
});
