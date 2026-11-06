// Gasto de Meta Ads del período cruzado con los leads, demos y ventas que trajo cada anuncio.
export type ResumenAnuncios =
  | { error: string }
  | {
      cuenta: string;
      moneda: string;
      gasto: number;
      leads: number;
      demos: number;
      ventas: number;
      ingresos: number;
      costoPorLead: number | null;
      costoPorDemo: number | null;
      costoPorVenta: number | null;
      retorno: number | null;
      porAnuncio: {
        adId: string;
        nombre: string | null;
        campana: string | null;
        gasto: number;
        leads: number;
        demos: number;
        ventas: number;
        ingresos: number;
        costoPorLead: number | null;
      }[];
    };

export default function InversionMeta({ r }: { r: ResumenAnuncios }) {
  if ('error' in r) return <p className="text-sm text-peligro">{r.error}. Revisa el token en Canales.</p>;
  const plata = (n: number | null) =>
    n === null ? '—' : n.toLocaleString('es-PE', { style: 'currency', currency: r.moneda, maximumFractionDigits: 2 });
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            ['Invertido', plata(r.gasto)],
            ['Costo por lead', plata(r.costoPorLead)],
            ['Costo por demo', plata(r.costoPorDemo)],
            ['Costo por venta', plata(r.costoPorVenta)],
            ['Retorno', r.retorno === null ? '—' : `${r.retorno.toFixed(2)}×`],
          ] as const
        ).map(([t, v]) => (
          <div key={t}>
            <dt className="text-xs text-gris">{t}</dt>
            <dd className="font-display text-xl font-bold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {r.porAnuncio.length === 0 ? (
        <p className="text-sm text-gris">Sin gasto ni leads de anuncios en el período.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-left text-xs text-gris">
              <tr>
                <th className="py-2 font-medium">Anuncio</th>
                <th className="py-2 text-right font-medium">Invertido</th>
                <th className="py-2 text-right font-medium">Leads</th>
                <th className="py-2 text-right font-medium">Costo por lead</th>
                <th className="py-2 text-right font-medium">Demos</th>
                <th className="py-2 text-right font-medium">Ventas</th>
                <th className="py-2 text-right font-medium">Vendido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea tabular-nums">
              {r.porAnuncio.map((a) => (
                <tr key={a.adId}>
                  <td className="max-w-64 truncate py-2" title={a.campana ? `${a.campana}: ${a.nombre ?? a.adId}` : (a.nombre ?? a.adId)}>
                    {a.nombre ?? `Anuncio ${a.adId}`}
                    {a.campana && <span className="block text-xs text-gris">{a.campana}</span>}
                  </td>
                  <td className="py-2 text-right">{plata(a.gasto)}</td>
                  <td className="py-2 text-right">{a.leads}</td>
                  <td className="py-2 text-right">{plata(a.costoPorLead)}</td>
                  <td className="py-2 text-right">{a.demos}</td>
                  <td className="py-2 text-right">{a.ventas}</td>
                  <td className="py-2 text-right">{plata(a.ingresos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gris">Cuenta {r.cuenta}. El gasto no se divide por línea ni por comercial: Meta no conoce esos datos.</p>
    </>
  );
}
