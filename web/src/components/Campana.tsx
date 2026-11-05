'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { IconoCampana } from '@/components/Iconos';
import { API, api } from '@/lib/api';
import { conectarEventos } from '@/lib/eventos';
import { leerToken } from '@/lib/sesion';

export interface Alerta {
  id: string;
  tipo: string;
  titulo: string;
  detalle: string;
  enlace: string | null;
  leida: boolean;
  createdAt: string;
}

// Campanita con las alertas del miembro; llegan en vivo por el mismo canal de eventos de la bandeja.
export default function Campana({ oscura = false }: { oscura?: boolean }) {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [abierta, setAbierta] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cargar = () => api<Alerta[]>('/alertas').then((r) => r.data && setAlertas(r.data));
    cargar();
    return conectarEventos<{ tipo: string; alerta?: Alerta }>({
      url: () => {
        const t = leerToken();
        return t ? `${API}/eventos?token=${encodeURIComponent(t)}` : null;
      },
      onResync: cargar,
      onSinSesion: () => undefined,
      onEvento: (ev) => {
        if (ev.tipo === 'alerta' && ev.alerta) setAlertas((a) => [ev.alerta!, ...a].slice(0, 50));
      },
    });
  }, []);

  useEffect(() => {
    if (!abierta) return;
    const fuera = (e: MouseEvent) => !caja.current?.contains(e.target as Node) && setAbierta(false);
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierta]);

  const sinLeer = alertas.filter((a) => !a.leida).length;
  function alternar() {
    setAbierta(!abierta);
    if (!abierta && sinLeer) {
      void api('/alertas/leidas', { method: 'POST' });
      setTimeout(() => setAlertas((a) => a.map((x) => ({ ...x, leida: true }))), 1500);
    }
  }

  return (
    <div ref={caja} className="relative">
      <button onClick={alternar} className={`relative rounded-lg p-1.5 ${oscura ? 'text-white/70 hover:bg-white/10' : 'text-gris hover:bg-papel'}`} title="Alertas" aria-expanded={abierta}>
        <IconoCampana />
        {sinLeer > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-mango px-1 text-[10px] font-bold text-tinta">{sinLeer > 9 ? '9+' : sinLeer}</span>
        )}
        <span className="sr-only">Alertas{sinLeer ? `, ${sinLeer} sin leer` : ''}</span>
      </button>
      {abierta && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-linea bg-white text-tinta shadow-xl md:bottom-0 md:left-full md:right-auto md:mb-0 md:ml-3 md:mt-0">
          <div className="flex items-center justify-between border-b border-linea px-4 py-2.5">
            <p className="font-semibold">Alertas</p>
            <Link href="/alertas" onClick={() => setAbierta(false)} className="text-xs text-uva underline">
              Elegir cuáles recibo
            </Link>
          </div>
          <ul className="max-h-96 divide-y divide-linea overflow-y-auto">
            {alertas.length === 0 && <li className="p-6 text-center text-sm text-gris">Sin alertas por ahora.</li>}
            {alertas.map((a) => {
              const cuerpo = (
                <>
                  <p className={`text-sm ${a.leida ? '' : 'font-semibold'}`}>{a.titulo}</p>
                  {a.detalle && <p className="text-xs text-gris">{a.detalle}</p>}
                  <p className="mt-0.5 text-[11px] text-gris">{new Date(a.createdAt).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</p>
                </>
              );
              return (
                <li key={a.id} className={a.leida ? '' : 'bg-mango-suave/50'}>
                  {a.enlace ? (
                    <Link href={a.enlace} onClick={() => setAbierta(false)} className="block px-4 py-3 hover:bg-papel">
                      {cuerpo}
                    </Link>
                  ) : (
                    <div className="px-4 py-3">{cuerpo}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
