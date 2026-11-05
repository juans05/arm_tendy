'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '@/components/Avatar';
import Chat, { ChipModo } from '@/components/bandeja/Chat';
import AccionesLead from '@/components/bandeja/AccionesLead';
import PanelLead from '@/components/bandeja/PanelLead';
import Plantillas from '@/components/bandeja/Plantillas';
import { IconoBandeja, IconoCelular } from '@/components/Iconos';
import { API, api } from '@/lib/api';
import { aplicarEvento, ConversacionResumen, EventoBandeja, Lead, Mensaje } from '@/lib/bandeja';
import { conectarEventos } from '@/lib/eventos';
import { useMiembro } from '@/lib/miembro-ctx';
import { leerToken } from '@/lib/sesion';
import { hora } from '@/components/bandeja/Burbuja';

function cuando(iso: string, ahora = new Date()) {
  const d = new Date(iso);
  const min = Math.floor((ahora.getTime() - d.getTime()) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `${min} min`;
  if (d.toDateString() === ahora.toDateString()) return hora(iso);
  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return 'ayer';
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

type Filtro = 'todas' | 'sin-leer' | 'mios';
const FILTROS: Record<Filtro, string> = { todas: 'Todas', 'sin-leer': 'Sin leer', mios: 'Mis leads' };

export default function PaginaBandeja() {
  return (
    <Suspense>
      <Bandeja />
    </Suspense>
  );
}

function Bandeja() {
  const { miembro } = useMiembro();
  const router = useRouter();
  const params = useSearchParams();
  const [lista, setLista] = useState<ConversacionResumen[] | null>(null);
  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [lead, setLead] = useState<Lead | null>(null);
  const [panel, setPanel] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busqueda, setBusqueda] = useState('');
  const abiertaRef = useRef<string | null>(null);
  abiertaRef.current = abiertaId;
  const listaRef = useRef(lista);
  listaRef.current = lista;

  const cargarLista = useCallback(() => api<ConversacionResumen[]>('/conversaciones').then((r) => r.data && setLista(r.data)), []);

  const abrir = useCallback(async (id: string) => {
    setAbiertaId(id);
    setMensajes([]);
    setLead(null);
    setLista((l) => l?.map((c) => (c.id === id ? { ...c, noLeidos: 0 } : c)) ?? l);
    const r = await api<Mensaje[]>(`/conversaciones/${id}/mensajes`);
    if (r.data && abiertaRef.current === id) setMensajes(r.data);
  }, []);

  // Enlaces desde el embudo, el calendario o una alerta: /bandeja?c=<conversación>
  const pedida = params.get('c');
  useEffect(() => {
    if (pedida) void abrir(pedida);
  }, [pedida, abrir]);

  useEffect(() => {
    cargarLista();
    const recargarAbierta = () => {
      const id = abiertaRef.current;
      if (id) api<Mensaje[]>(`/conversaciones/${id}/mensajes`).then((r) => r.data && abiertaRef.current === id && setMensajes(r.data));
    };
    // Tiempo real: EventSource no admite cabeceras, el token va en la URL (solo esta ruta lo acepta).
    return conectarEventos<EventoBandeja>({
      url: () => {
        const t = leerToken();
        return t ? `${API}/eventos?token=${encodeURIComponent(t)}` : null;
      },
      onResync: () => {
        cargarLista();
        recargarAbierta();
      },
      onSinSesion: () => router.replace('/login'),
      onEvento: (ev) => {
        if (ev.tipo === 'lead') {
          if (ev.conversacionId === abiertaRef.current) setLead(ev.lead);
          return;
        }
        if (ev.tipo !== 'mensaje' && ev.tipo !== 'conversacion') return;
        // Conversación nueva: se recarga la lista para traer el nombre del contacto.
        if (listaRef.current && !listaRef.current.some((c) => c.id === ev.conversacionId)) cargarLista();
        setLista((l) => (l ? aplicarEvento(l, ev, abiertaRef.current) : l));
        if (ev.tipo === 'mensaje' && ev.conversacionId === abiertaRef.current) {
          setMensajes((ms) => (ms.some((m) => m.id === ev.mensaje.id) ? ms.map((m) => (m.id === ev.mensaje.id ? ev.mensaje : m)) : [...ms, ev.mensaje]));
          // ponytail: marcar como leído recargando los mensajes; un endpoint propio si pesa.
          if (ev.mensaje.direccion === 'entrante') api(`/conversaciones/${ev.conversacionId}/mensajes`);
        }
      },
    });
  }, [cargarLista, router]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (lista ?? []).filter(
      (c) =>
        (filtro === 'todas' || (filtro === 'sin-leer' && c.noLeidos > 0) || (filtro === 'mios' && c.duenoId === miembro.id)) &&
        (!q || c.contacto.nombre.toLowerCase().includes(q) || c.contacto.telefono.includes(q)),
    );
  }, [lista, filtro, busqueda, miembro.id]);
  const sinLeer = (lista ?? []).filter((c) => c.noLeidos > 0).length;
  const abierta = lista?.find((c) => c.id === abiertaId) ?? null;
  const alEnviar = (m: Mensaje) => {
    if (!abierta) return;
    setMensajes((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m]));
    setLista((l) => (l ? aplicarEvento(l, { tipo: 'mensaje', conversacionId: abierta.id, mensaje: m }, abierta.id) : l));
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Lista */}
      <section className={`min-h-0 w-full flex-col border-r border-linea bg-white md:flex md:w-[22rem] lg:w-[24rem] ${abiertaId ? 'hidden' : 'flex'}`}>
        <div className="space-y-3 border-b border-linea px-4 pb-3 pt-4">
          <div className="flex items-baseline justify-between">
            <h1 className="font-display text-2xl font-bold">Bandeja</h1>
            {sinLeer > 0 && <span className="text-sm text-gris">{sinLeer === 1 ? '1 chat sin leer' : `${sinLeer} chats sin leer`}</span>}
          </div>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o número"
            aria-label="Buscar conversación"
            className="w-full rounded-xl border border-linea bg-papel px-3.5 py-2.5 text-sm outline-none placeholder:text-gris focus:border-uva"
          />
          <div className="flex gap-2" role="tablist">
            {(Object.keys(FILTROS) as Filtro[]).map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filtro === f}
                onClick={() => setFiltro(f)}
                className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${filtro === f ? 'bg-tinta text-white' : 'bg-papel text-gris hover:text-tinta'}`}
              >
                {FILTROS[f]}
              </button>
            ))}
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {lista === null && <Esqueleto />}
          {lista?.length === 0 && <Vacia gerente={miembro.rol === 'gerente'} />}
          {lista && lista.length > 0 && visibles.length === 0 && <p className="p-6 text-center text-sm text-gris">Nada por aquí con ese filtro.</p>}
          {visibles.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => abrir(c.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${c.id === abiertaId ? 'bg-uva-suave' : 'hover:bg-papel'}`}
              >
                <Avatar nombre={c.contacto.nombre} semilla={c.contacto.telefono || c.id} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className={`truncate ${c.noLeidos ? 'font-bold' : 'font-medium'}`}>{c.contacto.nombre}</p>
                    <span className={`ml-auto shrink-0 text-xs ${c.noLeidos ? 'font-semibold text-tinta' : 'text-gris'}`}>{cuando(c.ultimoMensajeEn)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <ChipModo modo={c.modo} chico />
                    <p className={`truncate text-sm ${c.noLeidos ? 'text-tinta' : 'text-gris'}`}>
                      {c.borrador ? <span className="text-menta">Borrador de la IA: </span> : null}
                      {c.ultimoTexto ?? ''}
                    </p>
                    {c.noLeidos > 0 && (
                      <span className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-mango px-1.5 text-xs font-bold text-tinta">
                        {c.noLeidos > 99 ? '99+' : c.noLeidos}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Chat */}
      <section className={`min-h-0 min-w-0 flex-1 flex-col bg-papel ${abiertaId ? 'flex' : 'hidden md:flex'}`}>
        {abierta ? (
          <Chat
            key={abierta.id}
            conv={abierta}
            mensajes={mensajes}
            onVolver={() => setAbiertaId(null)}
            onEnviado={alEnviar}
            onPanel={() => setPanel((p) => !p)}
            extraComposer={<Plantillas conversacionId={abierta.id} onEnviado={alEnviar} />}
          />
        ) : (
          <div className="m-auto max-w-xs p-8 text-center text-gris">
            <IconoBandeja className="mx-auto mb-3 size-10 text-linea" />
            <p className="font-display text-lg font-semibold text-tinta">Elige una conversación</p>
            <p className="mt-1 text-sm">Los mensajes nuevos aparecen solos, no hace falta recargar.</p>
          </div>
        )}
      </section>

      {/* Lead: columna en pantallas grandes, hoja completa en el celular */}
      {abierta && panel && (
        <div className="fixed inset-0 z-30 bg-white md:static md:z-auto md:w-80 md:shrink-0 md:border-l md:border-linea">
          <PanelLead
            conversacionId={abierta.id}
            lead={lead}
            onLead={setLead}
            onCerrar={() => setPanel(false)}
            acciones={lead && <AccionesLead lead={lead} onLead={setLead} />}
          />
        </div>
      )}
    </div>
  );
}

function Esqueleto() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex animate-pulse items-center gap-3 px-4 py-3">
          <span className="size-11 rounded-[38%] bg-papel" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-1/2 rounded bg-papel" />
            <span className="block h-3 w-3/4 rounded bg-papel" />
          </span>
        </li>
      ))}
    </>
  );
}

function Vacia({ gerente }: { gerente: boolean }) {
  return (
    <li className="px-6 py-12 text-center">
      <IconoCelular className="mx-auto mb-3 size-10 text-mango" />
      <p className="font-display text-lg font-semibold">Todavía no hay conversaciones</p>
      <p className="mt-1 text-sm text-gris">Cuando un cliente escriba a tu WhatsApp de ventas, aparecerá aquí al instante.</p>
      {gerente && (
        <Link href="/canales" className="mt-4 inline-block rounded-xl bg-tinta px-4 py-2.5 text-sm font-semibold text-white">
          Conectar WhatsApp
        </Link>
      )}
    </li>
  );
}
