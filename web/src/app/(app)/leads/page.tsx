'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Avatar from '@/components/Avatar';
import { useAvisos } from '@/components/Avisos';
import { IconoBuscar, IconoCerrar, IconoTabla } from '@/components/Iconos';
import { Boton, Campo, ChipEtapa, ChipFiltro, clasesFiltro, COLOR_ETAPA, Encabezado, Puntaje, SelectorFiltro, Vacio } from '@/components/ui';
import { api, Linea, Miembro } from '@/lib/api';
import { aQuery, Filtros, LeadFila, Orden, Vista } from '@/lib/actividad';
import { Etapa, ETAPAS } from '@/lib/bandeja';
import { useMiembro } from '@/lib/miembro-ctx';

const POR_PAGINA = 50;
const ETAPAS_FILTRO: Etapa[] = ['nuevo', 'en_conversacion', 'demo_agendada', 'demo_realizada', 'no_asistio', 'seguimiento', 'ganado', 'perdido', 'archivado', 'descartado'];
const ORDENES: [Orden, string][] = [
  ['reciente', 'Movidos hace poco'],
  ['antiguo', 'Quietos hace más tiempo'],
  ['puntaje', 'Más interesados'],
  ['monto', 'Mayor monto'],
  ['nombre', 'Nombre (A–Z)'],
];
const soles = (n: number) => n.toLocaleString('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 });
const hace = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} d`;
};
// Las 10 etapas en un solo botón: "Etapa" abre la lista con casillas y muestra cuántas van elegidas.
function MenuEtapas({ elegidas, alternar, limpiar }: { elegidas: Etapa[]; alternar: (e: Etapa) => void; limpiar: () => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const cerrar = (ev: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(ev.target as Node)) ref.current.open = false;
    };
    document.addEventListener('click', cerrar);
    return () => document.removeEventListener('click', cerrar);
  }, []);
  const titulo = elegidas.length === 0 ? 'Todas las etapas' : elegidas.length === 1 ? ETAPAS[elegidas[0]] : `Etapa · ${elegidas.length}`;
  return (
    <details ref={ref} className="relative">
      <summary className={`inline-flex list-none items-center gap-1 [&::-webkit-details-marker]:hidden ${clasesFiltro(elegidas.length > 0)}`}>
        {titulo} <span aria-hidden>▾</span>
      </summary>
      <div className="absolute left-0 z-20 mt-1 w-56 rounded-xl border border-linea bg-hoja p-1.5 shadow-flota">
        {ETAPAS_FILTRO.map((e) => (
          <label key={e} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-tinta/5">
            <input type="checkbox" checked={elegidas.includes(e)} onChange={() => alternar(e)} className="size-4 accent-tinta" />
            <span className="size-2 rounded-full" style={{ background: COLOR_ETAPA[e] }} />
            {ETAPAS[e]}
          </label>
        ))}
        {elegidas.length > 0 && (
          <button type="button" onClick={limpiar} className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-gris hover:bg-tinta/5 hover:text-tinta">
            Ver todas
          </button>
        )}
      </div>
    </details>
  );
}

const iguales = (a: Filtros, b: Filtros) => JSON.stringify({ ...a, q: a.q || undefined }) === JSON.stringify({ ...b, q: b.q || undefined });

export default function Leads() {
  const { miembro } = useMiembro();
  const gerente = miembro.rol === 'gerente';
  const router = useRouter();
  const { avisar, confirmar } = useAvisos();
  const [filtros, setFiltros] = useState<Filtros>({});
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<{ items: LeadFila[]; total: number } | null>(null);
  const [vistas, setVistas] = useState<Vista[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [equipo, setEquipo] = useState<Miembro[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [q, setQ] = useState('');

  const cargar = useCallback(async (f: Filtros, p: number) => {
    const r = await api<{ items: LeadFila[]; total: number }>(`/leads/tabla?${aQuery(f, p, POR_PAGINA)}`);
    setDatos(r.data ?? { items: [], total: 0 });
  }, []);

  useEffect(() => {
    void cargar(filtros, pagina);
  }, [filtros, pagina, cargar]);

  // La búsqueda espera a que dejes de escribir.
  useEffect(() => {
    const id = setTimeout(() => {
      setFiltros((f) => (f.q === q ? f : { ...f, q }));
      setPagina(1);
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    api<Vista[]>('/vistas').then((r) => setVistas(r.data ?? []));
    api<Linea[]>('/lineas').then((r) => setLineas(r.data ?? []));
    if (gerente) api<Miembro[]>('/miembros').then((r) => setEquipo((r.data ?? []).filter((m) => m.estado === 'activo')));
  }, [gerente]);

  const cambiar = (c: Partial<Filtros>) => {
    setFiltros((f) => ({ ...f, ...c }));
    setPagina(1);
  };
  const alternarEtapa = (e: Etapa) => {
    const actuales = filtros.etapas ?? [];
    cambiar({ etapas: actuales.includes(e) ? actuales.filter((x) => x !== e) : [...actuales, e] });
  };
  const aplicarVista = (v: Vista | null) => {
    const f = v?.filtros ?? {};
    setFiltros(f);
    setQ(f.q ?? '');
    setPagina(1);
  };

  const vistaActual = vistas.find((v) => iguales(v.filtros, filtros));
  const hayFiltros = !iguales(filtros, {});
  const nombre = (id: string | null) => (id === miembro.id ? 'Tú' : (equipo.find((m) => m.id === id)?.nombre ?? (id ? 'Otro comercial' : null)));
  const desde = datos?.total ? (pagina - 1) * POR_PAGINA + 1 : 0;
  const hasta = Math.min(pagina * POR_PAGINA, datos?.total ?? 0);

  async function borrarVista(v: Vista) {
    if (!(await confirmar({ titulo: `¿Borrar la vista “${v.nombre}”?`, texto: v.compartida ? 'Es compartida: deja de verse para todo el equipo.' : undefined, accion: 'Borrar vista', peligro: true }))) return;
    const r = await api(`/vistas/${v.id}`, { method: 'DELETE' });
    if (r.status !== 204) return avisar(r.message ?? 'No se pudo borrar la vista', { tipo: 'error' });
    setVistas((vs) => vs.filter((x) => x.id !== v.id));
    avisar('Vista borrada');
  }

  return (
    <section className="pb-10">
      <Encabezado
        titulo="Leads"
        texto={datos ? `${datos.total.toLocaleString('es-PE')} ${datos.total === 1 ? 'lead' : 'leads'}${hayFiltros ? ' con estos filtros' : ''}` : 'Cargando…'}
      >
        {hayFiltros && !vistaActual && (
          <Boton variante="secundario" onClick={() => setGuardando(true)}>
            Guardar como vista
          </Boton>
        )}
      </Encabezado>

      {/* Vistas guardadas */}
      <div className="flex gap-1 overflow-x-auto border-b border-linea px-4 md:px-8" role="tablist">
        {[null, ...vistas].map((v) => {
          const sel = v ? vistaActual?.id === v.id : !hayFiltros;
          return (
            <div key={v?.id ?? 'todos'} className={`group relative flex shrink-0 items-center border-b-2 ${sel ? 'border-tinta' : 'border-transparent'}`}>
              <button role="tab" aria-selected={sel} onClick={() => aplicarVista(v)} className={`py-2.5 pl-2 pr-2 text-sm ${sel ? 'font-bold' : 'text-gris hover:text-tinta'}`}>
                {v ? v.nombre : 'Todos'}
                {v?.compartida && <span className="ml-1.5 text-xs font-normal text-gris-2">equipo</span>}
              </button>
              {v && (v.miembroId === miembro.id || (gerente && v.compartida)) && (
                <button onClick={() => borrarVista(v)} className="mr-1 rounded p-0.5 text-gris-2 opacity-0 hover:text-peligro focus:opacity-100 group-hover:opacity-100" title={`Borrar ${v.nombre}`}>
                  <IconoCerrar className="size-3.5" />
                  <span className="sr-only">Borrar vista {v.nombre}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-3 md:px-8">
        <label className="relative">
          <IconoBuscar className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gris" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nombre, teléfono, RUC…"
            aria-label="Buscar leads"
            className={`${clasesFiltro(!!q)} w-60 cursor-text pl-7 placeholder:font-normal placeholder:text-gris-2`}
          />
        </label>
        <MenuEtapas elegidas={filtros.etapas ?? []} alternar={alternarEtapa} limpiar={() => cambiar({ etapas: undefined })} />
        {lineas.length > 1 && (
          <SelectorFiltro activo={!!filtros.lineaId} value={filtros.lineaId ?? ''} onChange={(e) => cambiar({ lineaId: e.target.value || undefined })} aria-label="Línea">
            <option value="">Todas las líneas</option>
            {lineas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nombre}
              </option>
            ))}
          </SelectorFiltro>
        )}
        <SelectorFiltro activo={!!filtros.duenoId} value={filtros.duenoId ?? ''} onChange={(e) => cambiar({ duenoId: e.target.value || undefined })} aria-label="Dueño">
          <option value="">{gerente ? 'Todo el equipo' : 'Míos y sin dueño'}</option>
          {!gerente && <option value={miembro.id}>Solo míos</option>}
          <option value="sin">Sin dueño</option>
          {equipo.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </SelectorFiltro>
        <ChipFiltro activo={!!filtros.calificado} onClick={() => cambiar({ calificado: filtros.calificado ? undefined : true })}>
          Calificados por la IA
        </ChipFiltro>
        {hayFiltros && (
          <button onClick={() => aplicarVista(null)} className="px-1 text-xs font-semibold text-gris underline decoration-linea-2 underline-offset-4 hover:text-tinta">
            Quitar filtros
          </button>
        )}
        {/* El orden no filtra: va aparte, a la derecha. */}
        <SelectorFiltro activo={false} value={filtros.orden ?? 'reciente'} onChange={(e) => cambiar({ orden: e.target.value as Orden })} aria-label="Orden" className="ml-auto">
          {ORDENES.map(([v, t]) => (
            <option key={v} value={v}>
              ↕ {t}
            </option>
          ))}
        </SelectorFiltro>
      </div>

      {/* Resultados */}
      <div className="px-4 md:px-8">
        {datos && datos.items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-linea-2">
            <Vacio
              icono={<IconoTabla />}
              titulo={hayFiltros ? 'Ningún lead con estos filtros' : 'Todavía no hay leads'}
              texto={hayFiltros ? 'Prueba quitando una etapa o buscando por teléfono.' : 'Cada cliente que escribe a tu WhatsApp aparece aquí.'}
              accion={hayFiltros ? <Boton variante="secundario" onClick={() => aplicarVista(null)}>Quitar filtros</Boton> : undefined}
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-linea bg-hoja shadow-hoja">
            {/* Escritorio: tabla */}
            <table className="hidden w-full text-left text-sm md:table">
              <thead className="border-b border-linea text-xs text-gris">
                <tr>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-3 py-3 font-semibold">Etapa</th>
                  <th className="px-3 py-3 font-semibold">Interés</th>
                  <th className="px-3 py-3 font-semibold">Línea</th>
                  <th className="px-3 py-3 font-semibold">Dueño</th>
                  <th className="px-3 py-3 text-right font-semibold">Monto</th>
                  <th className="px-4 py-3 text-right font-semibold">Movido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {datos === null &&
                  [0, 1, 2, 3].map((i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-4 py-3">
                        <div className="h-8 animate-pulse rounded-lg bg-papel" />
                      </td>
                    </tr>
                  ))}
                {datos?.items.map((l) => (
                  <tr key={l.id} onClick={() => router.push(`/leads/${l.id}`)} className="cursor-pointer transition-colors hover:bg-papel/70">
                    <td className="px-4 py-2.5">
                      <Link href={`/leads/${l.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <Avatar nombre={l.contacto?.nombre ?? '?'} tam="size-8" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{l.contacto?.nombre ?? 'Cliente'}</span>
                          <span className="tabular block text-xs text-gris">+{l.contacto?.telefono}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <ChipEtapa etapa={l.etapa} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Puntaje valor={l.puntaje} />
                    </td>
                    <td className="px-3 py-2.5 text-gris">{lineas.find((x) => x.id === l.lineaId)?.nombre ?? '—'}</td>
                    <td className="px-3 py-2.5">{nombre(l.duenoId) ?? <span className="font-semibold text-mango-oscuro">Sin dueño</span>}</td>
                    <td className="tabular px-3 py-2.5 text-right">{l.monto ? soles(l.monto) : <span className="text-gris-2">—</span>}</td>
                    <td className="px-4 py-2.5 text-right text-gris">{hace(l.etapaEn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Celular: lista */}
            <ul className="divide-y divide-linea md:hidden">
              {datos?.items.map((l) => (
                <li key={l.id}>
                  <Link href={`/leads/${l.id}`} className="flex items-center gap-3 px-4 py-3">
                    <Avatar nombre={l.contacto?.nombre ?? '?'} tam="size-10" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{l.contacto?.nombre ?? 'Cliente'}</span>
                      <span className="mt-1 flex items-center gap-2">
                        <ChipEtapa etapa={l.etapa} />
                        <span className="text-xs text-gris">{hace(l.etapaEn)}</span>
                      </span>
                    </span>
                    <span className="tabular font-display text-lg font-bold">{l.puntaje}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {datos && datos.total > POR_PAGINA && (
          <div className="mt-4 flex items-center justify-end gap-3 text-sm">
            <span className="tabular text-gris">
              {desde}–{hasta} de {datos.total}
            </span>
            <Boton variante="secundario" tam="sm" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>
              Anterior
            </Boton>
            <Boton variante="secundario" tam="sm" disabled={hasta >= datos.total} onClick={() => setPagina((p) => p + 1)}>
              Siguiente
            </Boton>
          </div>
        )}
      </div>

      {guardando && (
        <GuardarVista
          gerente={gerente}
          onCerrar={() => setGuardando(false)}
          onGuardar={async (nombreVista, compartida) => {
            const r = await api<Vista>('/vistas', { method: 'POST', body: JSON.stringify({ nombre: nombreVista, filtros, compartida }) });
            if (!r.data) return avisar(r.message ?? 'No se pudo guardar la vista', { tipo: 'error' });
            setVistas((vs) => [...vs, r.data!]);
            setGuardando(false);
            avisar(`Vista “${r.data.nombre}” guardada`);
          }}
        />
      )}
    </section>
  );
}

function GuardarVista({ gerente, onCerrar, onGuardar }: { gerente: boolean; onCerrar: () => void; onGuardar: (nombre: string, compartida: boolean) => Promise<void> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [nombre, setNombre] = useState('');
  const [compartida, setCompartida] = useState(gerente);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => ref.current?.showModal(), []);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    await onGuardar(nombre.trim(), compartida);
    setOcupado(false);
  }
  return (
    <dialog ref={ref} onClose={onCerrar} className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl bg-hoja p-0 text-tinta shadow-flota">
      <form onSubmit={enviar} className="space-y-4 p-6">
        <h2 className="font-display text-xl font-bold">Guardar vista</h2>
        <Campo etiqueta="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={60} placeholder="Demos sin venta del mes" autoFocus />
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={compartida} onChange={(e) => setCompartida(e.target.checked)} className="mt-0.5 size-4 accent-tinta" />
          <span>
            <span className="font-semibold">Compartir con el equipo</span>
            <span className="block text-gris">Todos la verán en sus pestañas.</span>
          </span>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Boton type="button" variante="fantasma" onClick={onCerrar}>
            Cancelar
          </Boton>
          <Boton cargando={ocupado} disabled={!nombre.trim()}>
            Guardar vista
          </Boton>
        </div>
      </form>
    </dialog>
  );
}
