'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DragEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '@/components/Avatar';
import { COLOR_ETAPA, Encabezado, Selector } from '@/components/ui';
import { API, api, Linea, Miembro } from '@/lib/api';
import { Etapa, ETAPAS, EventoBandeja, Lead } from '@/lib/bandeja';
import { conectarEventos } from '@/lib/eventos';
import { useMiembro } from '@/lib/miembro-ctx';
import { leerToken } from '@/lib/sesion';

type LeadConContacto = Lead & { contacto?: { nombre: string; telefono: string } };

const COLUMNAS: Etapa[] = ['nuevo', 'en_conversacion', 'demo_agendada', 'demo_realizada', 'no_asistio', 'seguimiento', 'ganado', 'perdido'];
const CERRADAS: Etapa[] = ['archivado', 'descartado'];
// Al llegar a estas etapas hay que contar algo más (monto o motivo).
const PIDEN_DATOS: Etapa[] = ['ganado', 'perdido', 'descartado'];

const dias = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
const soles = (n: number) => n.toLocaleString('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 });

export default function Embudo() {
  const { miembro } = useMiembro();
  const gerente = miembro.rol === 'gerente';
  const router = useRouter();
  const [leads, setLeads] = useState<LeadConContacto[] | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [equipo, setEquipo] = useState<Miembro[]>([]);
  const [lineaId, setLineaId] = useState('');
  const [duenoId, setDuenoId] = useState('');
  const [verCerrados, setVerCerrados] = useState(false);
  const [error, setError] = useState('');
  const [pendiente, setPendiente] = useState<{ lead: LeadConContacto; etapa: Etapa } | null>(null);
  const arrastrado = useRef<string | null>(null);

  const cargar = useCallback(() => {
    const q = new URLSearchParams();
    if (lineaId) q.set('lineaId', lineaId);
    if (duenoId) q.set('duenoId', duenoId);
    return api<LeadConContacto[]>(`/leads?${q}`).then((r) => setLeads(r.data ?? []));
  }, [lineaId, duenoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useEffect(() => {
    api<Linea[]>('/lineas').then((r) => setLineas(r.data ?? []));
    if (gerente) api<Miembro[]>('/miembros').then((r) => setEquipo((r.data ?? []).filter((m) => m.estado === 'activo')));
  }, [gerente]);

  // En vivo: la IA y los compañeros mueven leads mientras miras el tablero.
  useEffect(
    () =>
      conectarEventos<EventoBandeja>({
        url: () => {
          const t = leerToken();
          return t ? `${API}/eventos?token=${encodeURIComponent(t)}` : null;
        },
        onResync: cargar,
        onSinSesion: () => router.replace('/login'),
        onEvento: (ev) => {
          if (ev.tipo !== 'lead') return;
          setLeads((ls) => {
            if (!ls) return ls;
            const previo = ls.find((l) => l.id === ev.lead.id);
            if (!previo) {
              void cargar();
              return ls;
            }
            return ls.map((l) => (l.id === ev.lead.id ? { ...ev.lead, contacto: previo.contacto } : l));
          });
        },
      }),
    [cargar, router],
  );

  async function mover(lead: LeadConContacto, etapa: Etapa, extra: Record<string, unknown> = {}) {
    const r = await api<Lead>(`/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify({ etapa, ...extra }) });
    if (!r.data) return setError(r.message ?? 'No se pudo mover el lead');
    setError('');
    setLeads((ls) => ls?.map((l) => (l.id === lead.id ? { ...r.data!, contacto: l.contacto } : l)) ?? ls);
  }

  function soltar(e: DragEvent, etapa: Etapa) {
    e.preventDefault();
    const lead = leads?.find((l) => l.id === arrastrado.current);
    arrastrado.current = null;
    if (!lead || lead.etapa === etapa) return;
    if (PIDEN_DATOS.includes(etapa)) setPendiente({ lead, etapa });
    else void mover(lead, etapa);
  }

  const columnas = verCerrados ? [...COLUMNAS, ...CERRADAS] : COLUMNAS;
  const porEtapa = useMemo(() => {
    const m = new Map<Etapa, LeadConContacto[]>();
    for (const l of leads ?? []) m.set(l.etapa, [...(m.get(l.etapa) ?? []), l]);
    return m;
  }, [leads]);

  return (
    <section className="flex h-full min-h-0 flex-col">
      <Encabezado titulo="Embudo" texto="Arrastra una tarjeta para moverla de etapa. Tócala para abrir la ficha.">
        <Selector value={lineaId} onChange={(e) => setLineaId(e.target.value)} aria-label="Línea" className="w-auto">
          <option value="">Todas las líneas</option>
          {lineas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre}
            </option>
          ))}
        </Selector>
        {gerente && (
          <Selector value={duenoId} onChange={(e) => setDuenoId(e.target.value)} aria-label="Comercial" className="w-auto">
            <option value="">Todo el equipo</option>
            {equipo.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </Selector>
        )}
        <label className="flex items-center gap-2 text-sm text-gris">
          <input type="checkbox" checked={verCerrados} onChange={(e) => setVerCerrados(e.target.checked)} className="accent-tinta" />
          Archivados y descartados
        </label>
      </Encabezado>
      {error && <p className="px-4 text-sm text-peligro md:px-8">{error}</p>}

      <div className="flex min-h-0 flex-1 snap-x gap-3 overflow-x-auto px-4 pb-4 md:px-8">
        {columnas.map((etapa) => {
          const items = porEtapa.get(etapa) ?? [];
          const total = items.reduce((s, l) => s + (l.monto ?? 0), 0);
          return (
            <div
              key={etapa}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => soltar(e, etapa)}
              className="flex w-72 shrink-0 snap-start flex-col rounded-2xl border-t-[3px] bg-tinta/[0.03]"
              style={{ borderTopColor: COLOR_ETAPA[etapa] }}
            >
              <div className="flex items-baseline gap-2 px-3 py-2.5">
                <h2 className="font-display font-bold">{ETAPAS[etapa]}</h2>
                <span className="tabular text-sm text-gris">{items.length}</span>
                {etapa === 'ganado' && total > 0 && <span className="ml-auto text-sm font-semibold text-menta">{soles(total)}</span>}
              </div>
              <ul className="min-h-24 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {leads === null && <li className="h-20 animate-pulse rounded-xl bg-white" />}
                {items.map((l) => (
                  <li key={l.id} draggable onDragStart={() => (arrastrado.current = l.id)} className="cursor-grab active:cursor-grabbing">
                    <Link href={`/leads/${l.id}`} className="block rounded-xl border border-linea bg-hoja p-3 shadow-hoja transition hover:border-linea-2 hover:shadow-flota">
                      <div className="flex items-center gap-2.5">
                        <Avatar nombre={l.contacto?.nombre ?? '?'} semilla={l.contacto?.telefono ?? l.id} tam="size-8" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{l.contacto?.nombre ?? 'Cliente'}</p>
                          <p className="text-xs text-gris">
                            {lineas.find((x) => x.id === l.lineaId)?.nombre ?? 'Sin línea'}
                            {', '}
                            {dias(l.etapaEn) === 0 ? 'hoy' : `hace ${dias(l.etapaEn)} d`}
                          </p>
                        </div>
                        <span className="tabular font-display text-sm font-bold" title="Interés">
                          {l.puntaje}
                        </span>
                      </div>
                      {(l.monto || l.motivo) && (
                        <p className="mt-2 truncate text-xs text-gris">{l.monto ? `${soles(l.monto)}${l.plan ? `, ${l.plan}` : ''}` : l.motivo}</p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {pendiente && (
        <DatosDeCierre
          etapa={pendiente.etapa}
          onCancelar={() => setPendiente(null)}
          onGuardar={async (extra) => {
            await mover(pendiente.lead, pendiente.etapa, extra);
            setPendiente(null);
          }}
        />
      )}
    </section>
  );
}

function DatosDeCierre({
  etapa,
  onCancelar,
  onGuardar,
}: {
  etapa: Etapa;
  onCancelar: () => void;
  onGuardar: (extra: Record<string, unknown>) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [monto, setMonto] = useState('');
  const [plan, setPlan] = useState('');
  const [motivo, setMotivo] = useState('');
  useEffect(() => ref.current?.showModal(), []);

  function enviar(e: FormEvent) {
    e.preventDefault();
    void onGuardar(etapa === 'ganado' ? { monto: Number(monto), plan: plan || null } : { motivo });
  }

  return (
    <dialog ref={ref} onClose={onCancelar} className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl p-0 backdrop:bg-tinta/40">
      <form onSubmit={enviar} className="space-y-3 p-5">
        <h2 className="font-display text-xl font-bold">{etapa === 'ganado' ? '¡Venta cerrada!' : `Mover a ${ETAPAS[etapa]}`}</h2>
        {etapa === 'ganado' ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm font-medium">
              Monto (S/)
              <input autoFocus type="number" min={0} step="0.01" required value={monto} onChange={(e) => setMonto(e.target.value)} className="mt-1 w-full rounded-xl border border-linea px-3 py-2" />
            </label>
            <label className="text-sm font-medium">
              Plan
              <input value={plan} maxLength={100} onChange={(e) => setPlan(e.target.value)} className="mt-1 w-full rounded-xl border border-linea px-3 py-2" />
            </label>
          </div>
        ) : (
          <label className="block text-sm font-medium">
            Motivo
            <input autoFocus required maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: eligió a la competencia" className="mt-1 w-full rounded-xl border border-linea px-3 py-2" />
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => ref.current?.close()} className="rounded-xl px-4 py-2 text-sm text-gris">
            Cancelar
          </button>
          <button className="rounded-xl bg-tinta px-4 py-2 text-sm font-semibold text-white">Guardar</button>
        </div>
      </form>
    </dialog>
  );
}
