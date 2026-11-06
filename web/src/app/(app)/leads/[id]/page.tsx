'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Avatar from '@/components/Avatar';
import { useAvisos } from '@/components/Avisos';
import AccionesLead from '@/components/bandeja/AccionesLead';
import { IconoAtras, IconoBasura, IconoCalendario, IconoChat, IconoCheck, IconoChispa, IconoNota, IconoTareas } from '@/components/Iconos';
import { Area, Boton, BotonLink, Campo, ChipEtapa, COLOR_ETAPA, Puntaje, Selector, Vacio } from '@/components/ui';
import { api, Linea } from '@/lib/api';
import { ItemLinea, LeadFila, partesNota, Tarea, vencimiento } from '@/lib/actividad';
import { ETAPAS, Lead } from '@/lib/bandeja';
import { cargarEquipo, Companero } from '@/lib/equipo';
import { useMiembro } from '@/lib/miembro-ctx';

const soles = (n: number) => n.toLocaleString('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 });
const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
/** datetime-local quiere la hora local sin zona. */
const aLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const mananaALas10 = () => {
  const d = new Date(Date.now() + 86_400_000);
  d.setHours(10, 0, 0, 0);
  return aLocal(d);
};

// Ficha del lead: lo que se sabe, lo que falta hacer y todo lo que pasó, en un solo lugar.
export default function FichaLead() {
  const { id } = useParams<{ id: string }>();
  const { miembro } = useMiembro();
  const { avisar, confirmar } = useAvisos();
  const [lead, setLead] = useState<LeadFila | null | undefined>(undefined);
  const [linea, setLinea] = useState<ItemLinea[]>([]);
  const [equipo, setEquipo] = useState<Companero[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [modo, setModo] = useState<'nota' | 'tarea'>('nota');

  const cargarLinea = useCallback(() => api<ItemLinea[]>(`/leads/${id}/actividad`).then((r) => r.data && setLinea(r.data)), [id]);
  useEffect(() => {
    api<LeadFila>(`/leads/${id}`).then((r) => setLead(r.data ?? null));
    void cargarLinea();
    cargarEquipo().then(setEquipo);
    api<Linea[]>('/lineas').then((r) => setLineas(r.data ?? []));
  }, [id, cargarLinea]);

  const nombre = useCallback((mid: string | null) => (mid === miembro.id ? 'Tú' : (equipo.find((m) => m.id === mid)?.nombre ?? 'Alguien')), [equipo, miembro.id]);
  const pendientes = useMemo(
    () =>
      linea
        .filter((x): x is Extract<ItemLinea, { tipo: 'tarea' }> => x.tipo === 'tarea' && x.estado === 'pendiente')
        .sort((a, b) => (a.venceEn ?? '9').localeCompare(b.venceEn ?? '9')),
    [linea],
  );

  async function completar(t: { id: string; titulo: string; estado: string }) {
    const estado = t.estado === 'hecha' ? 'pendiente' : 'hecha';
    const r = await api<Tarea>(`/tareas/${t.id}`, { method: 'PATCH', body: JSON.stringify({ estado }) });
    if (!r.data) return avisar(r.message ?? 'No se pudo actualizar la tarea', { tipo: 'error' });
    await cargarLinea();
    if (estado === 'hecha')
      avisar(`Hecha: ${t.titulo}`, {
        deshacer: () => void api(`/tareas/${t.id}`, { method: 'PATCH', body: JSON.stringify({ estado: 'pendiente' }) }).then(cargarLinea),
      });
  }

  async function borrarNota(notaId: string) {
    if (!(await confirmar({ titulo: '¿Borrar esta nota?', texto: 'No se puede recuperar.', accion: 'Borrar nota', peligro: true }))) return;
    const r = await api(`/notas/${notaId}`, { method: 'DELETE' });
    if (r.status !== 204) return avisar(r.message ?? 'No se pudo borrar la nota', { tipo: 'error' });
    setLinea((l) => l.filter((x) => x.id !== notaId));
    avisar('Nota borrada');
  }

  if (lead === undefined) return <div className="m-8 h-40 animate-pulse rounded-2xl bg-hoja" />;
  if (lead === null)
    return <Vacio titulo="No encontramos este lead" texto="Puede ser de otro comercial o haber sido borrado." accion={<BotonLink href="/leads">Volver a leads</BotonLink>} />;

  const datos = Object.entries(lead.datos ?? {});
  const nombreLinea = lineas.find((l) => l.id === lead.lineaId)?.nombre;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 pt-5 md:px-8 md:pt-7">
      <Link href="/leads" className="inline-flex items-center gap-1 text-sm text-gris hover:text-tinta">
        <IconoAtras className="size-4" /> Leads
      </Link>

      {/* Cabecera */}
      <header className="mt-3 flex flex-wrap items-center gap-4">
        <Avatar nombre={lead.contacto?.nombre ?? '?'} tam="size-14" oscuro />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[2rem] font-extrabold leading-tight tracking-tight">{lead.contacto?.nombre ?? 'Cliente'}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gris">
            <span className="tabular">+{lead.contacto?.telefono}</span>
            <ChipEtapa etapa={lead.etapa} />
            {nombreLinea && <span>{nombreLinea}</span>}
            {lead.referral && <span className="text-uva">Llegó por un anuncio</span>}
          </p>
        </div>
        <BotonLink href={`/bandeja?c=${lead.conversacionId}`} variante="acento">
          <IconoChat className="size-4" /> Abrir chat
        </BotonLink>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Columna principal */}
        <div className="min-w-0">
          <div className="rounded-2xl border border-linea bg-hoja shadow-hoja">
            <div className="flex gap-1 border-b border-linea px-2 pt-2" role="tablist">
              {(
                [
                  ['nota', 'Nota', IconoNota],
                  ['tarea', 'Tarea', IconoTareas],
                ] as const
              ).map(([m, t, I]) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={modo === m}
                  onClick={() => setModo(m)}
                  className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${modo === m ? 'border-tinta font-bold' : 'border-transparent text-gris hover:text-tinta'}`}
                >
                  <I className="size-4" /> {t}
                </button>
              ))}
            </div>
            {modo === 'nota' ? (
              <NuevaNota
                leadId={lead.id}
                // Solo se sugiere a quien ve el lead: a los demás no les llegaría el aviso.
                equipo={equipo.filter((m) => m.id !== miembro.id && (m.rol === 'gerente' || !lead.duenoId || lead.duenoId === m.id))}
                onCreada={(menciones) => {
                  void cargarLinea();
                  avisar(menciones ? `Nota guardada. Avisamos a ${menciones} ${menciones === 1 ? 'compañero' : 'compañeros'}` : 'Nota guardada');
                }}
              />
            ) : (
              <NuevaTarea
                lead={lead}
                equipo={equipo}
                yo={miembro.id}
                onCreada={(t) => {
                  void cargarLinea();
                  avisar(`Tarea creada: ${t}`);
                }}
              />
            )}
          </div>

          <h2 className="mb-3 mt-10 font-display text-lg font-bold">Lo que pasó</h2>
          {linea.length === 0 ? (
            <p className="text-sm text-gris">Aún no hay movimientos. Las notas, tareas, demos y cambios de etapa aparecerán aquí.</p>
          ) : (
            <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-linea">
              {linea.map((x) => (
                <li key={`${x.tipo}-${x.id}`} className="entra relative flex gap-3">
                  <Marca item={x} />
                  <div className="min-w-0 flex-1 pb-4 pt-1">
                    <Contenido item={x} nombre={nombre} yo={miembro.id} gerente={miembro.rol === 'gerente'} onCompletar={completar} onBorrar={borrarNota} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Lateral */}
        <aside className="space-y-6">
          <div>
            <h2 className="mb-2 flex items-center justify-between font-display text-lg font-bold">
              Por hacer
              {pendientes.length > 0 && <span className="tabular rounded-full bg-tinta px-2 text-xs leading-5 text-white">{pendientes.length}</span>}
            </h2>
            {pendientes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-linea-2 px-3 py-4 text-sm text-gris">Nada pendiente. Crea una tarea para no olvidar el próximo paso.</p>
            ) : (
              <ul className="space-y-1.5">
                {pendientes.map((t) => {
                  const v = vencimiento(t.venceEn);
                  return (
                    <li key={t.id} className={`flex items-start gap-2.5 rounded-xl border bg-hoja px-3 py-2.5 ${v?.vencida ? 'border-mango' : 'border-linea'}`}>
                      <Casilla hecha={false} onClick={() => completar(t)} titulo={t.titulo} />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block font-semibold">{t.titulo}</span>
                        <span className={`block text-xs ${v?.vencida ? 'font-semibold text-mango-oscuro' : 'text-gris'}`}>
                          {v?.texto ?? 'Sin fecha'} · {nombre(t.responsableId)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-linea bg-hoja p-4 shadow-hoja">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg font-bold">Interés</h2>
              <Puntaje valor={lead.puntaje} />
            </div>
            <p className="mt-1 text-xs text-gris">{lead.calificado ? 'La IA lo calificó: cumple los criterios de la línea.' : 'Aún no cumple los criterios de la línea.'}</p>
            {lead.monto ? (
              <p className="mt-3 text-sm">
                Vendido: <strong className="tabular">{soles(lead.monto)}</strong>
                {lead.plan && `, ${lead.plan}`}
              </p>
            ) : null}
            {lead.motivo && <p className="mt-3 text-sm text-gris">Motivo: {lead.motivo}</p>}
            <div className="mt-4 border-t border-linea pt-4">
              <AccionesLead lead={lead} onLead={(l: Lead) => (setLead({ ...l, contacto: lead.contacto }), void cargarLinea(), avisar(`Lead en ${ETAPAS[l.etapa].toLowerCase()}`))} />
            </div>
          </div>

          <div>
            <h2 className="mb-2 font-display text-lg font-bold">Lo que contó el cliente</h2>
            {datos.length === 0 ? (
              <p className="text-sm text-gris">La IA anota aquí lo que el cliente dice en el chat: rubro, RUC, locales…</p>
            ) : (
              <dl className="divide-y divide-linea rounded-2xl border border-linea bg-hoja">
                {datos.map(([k, d]) => (
                  <div key={k} className="flex gap-3 px-3 py-2 text-sm" title={d.evidencia}>
                    <dt className="w-24 shrink-0 capitalize text-gris">{k.replace(/_/g, ' ')}</dt>
                    <dd className="tabular min-w-0 flex-1 break-words font-medium">{d.valor}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function Casilla({ hecha, onClick, titulo }: { hecha: boolean; onClick: () => void; titulo: string }) {
  return (
    <button
      onClick={onClick}
      role="checkbox"
      aria-checked={hecha}
      aria-label={hecha ? `Reabrir ${titulo}` : `Marcar hecha: ${titulo}`}
      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition ${hecha ? 'border-menta bg-menta text-white' : 'border-linea-2 hover:border-tinta'}`}
    >
      {hecha && <IconoCheck className="size-3.5" />}
    </button>
  );
}

function Marca({ item }: { item: ItemLinea }) {
  const estilo = 'relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2 border-papel';
  if (item.tipo === 'etapa') return <span className={estilo} style={{ background: COLOR_ETAPA[item.a] }} aria-hidden><span className="size-2 rounded-full bg-white" /></span>;
  if (item.tipo === 'nota') return <span className={`${estilo} bg-tinta text-white`} aria-hidden><IconoNota className="size-4" /></span>;
  if (item.tipo === 'cita') return <span className={`${estilo} bg-uva text-white`} aria-hidden><IconoCalendario className="size-4" /></span>;
  return (
    <span className={`${estilo} ${item.estado === 'hecha' ? 'bg-menta text-white' : 'bg-hoja text-tinta ring-1 ring-linea-2'}`} aria-hidden>
      {item.estado === 'hecha' ? <IconoCheck className="size-4" /> : item.origen === 'auto' ? <IconoChispa className="size-4" /> : <IconoTareas className="size-4" />}
    </span>
  );
}

function Contenido({
  item: x,
  nombre,
  yo,
  gerente,
  onCompletar,
  onBorrar,
}: {
  item: ItemLinea;
  nombre: (id: string | null) => string;
  yo: string;
  gerente: boolean;
  onCompletar: (t: { id: string; titulo: string; estado: string }) => void;
  onBorrar: (id: string) => void;
}) {
  const cuando = <time className="text-xs text-gris">{fecha(x.en)}</time>;
  if (x.tipo === 'etapa')
    return (
      <p className="text-sm">
        <span className="font-semibold">{x.miembroId ? nombre(x.miembroId) : 'La IA'}</span> lo movió a <strong>{ETAPAS[x.a]}</strong>
        {x.de && <span className="text-gris"> desde {ETAPAS[x.de].toLowerCase()}</span>} · {cuando}
      </p>
    );
  if (x.tipo === 'cita')
    return (
      <p className="text-sm">
        <strong>{x.titulo}</strong> con {nombre(x.miembroId)} · {cuando}
        <span className="ml-2 rounded-full bg-uva-suave px-2 py-0.5 text-xs font-semibold text-uva">
          {{ agendada: 'Agendada', realizada: 'Realizada', no_asistio: 'No asistió', cancelada: 'Cancelada' }[x.estado] ?? x.estado}
        </span>
      </p>
    );
  if (x.tipo === 'tarea') {
    const v = vencimiento(x.venceEn);
    return (
      <div className="flex items-start gap-2.5 text-sm">
        <Casilla hecha={x.estado === 'hecha'} onClick={() => onCompletar(x)} titulo={x.titulo} />
        <p className="min-w-0">
          <span className={`font-semibold ${x.estado === 'hecha' ? 'text-gris line-through decoration-linea-2' : ''}`}>{x.titulo}</span>
          <span className="block text-xs text-gris">
            {x.origen === 'auto' ? 'Automática' : 'Tarea'} para {nombre(x.responsableId)}
            {v && x.estado !== 'hecha' && <span className={v.vencida ? 'font-semibold text-mango-oscuro' : ''}> · {v.texto}</span>}
            {x.hechaEn && ` · hecha ${fecha(x.hechaEn)}`} · {cuando}
          </span>
        </p>
      </div>
    );
  }
  return (
    <div className="group rounded-2xl rounded-tl-sm border border-linea bg-hoja px-4 py-3 shadow-hoja">
      <p className="mb-1 flex items-center gap-2 text-sm">
        <span className="font-semibold">{nombre(x.autorId)}</span> {cuando}
        {(x.autorId === yo || gerente) && (
          <button onClick={() => onBorrar(x.id)} className="ml-auto rounded p-1 text-gris-2 opacity-0 hover:text-peligro focus:opacity-100 group-hover:opacity-100" title="Borrar nota">
            <IconoBasura className="size-4" />
            <span className="sr-only">Borrar nota</span>
          </button>
        )}
      </p>
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
        {partesNota(x.texto).map((p, i) => (p.mencion ? <span key={i} className="rounded bg-mango-suave px-0.5 font-semibold text-mango-oscuro">{p.t}</span> : p.t))}
      </p>
    </div>
  );
}

// Nota con @menciones: al escribir "@" se sugieren compañeros.
function NuevaNota({ leadId, equipo, onCreada }: { leadId: string; equipo: Companero[]; onCreada: (menciones: number) => void }) {
  const { avisar } = useAvisos();
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [sel, setSel] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);

  const consulta = /(^|\s)@([\w.-]*)$/.exec(texto.slice(0, area.current?.selectionStart ?? texto.length))?.[2];
  const sugerencias = consulta === undefined ? [] : equipo.filter((m) => `${m.username} ${m.nombre}`.toLowerCase().includes(consulta.toLowerCase())).slice(0, 5);

  const elegir = (m: Companero) => {
    const cursor = area.current?.selectionStart ?? texto.length;
    const antes = texto.slice(0, cursor).replace(/@([\w.-]*)$/, `@${m.username} `);
    setTexto(antes + texto.slice(cursor));
    setSel(0);
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(antes.length, antes.length);
    });
  };

  const teclas = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (sugerencias.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSel((s) => (s + (e.key === 'ArrowDown' ? 1 : -1) + sugerencias.length) % sugerencias.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        return elegir(sugerencias[sel]);
      }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void enviar();
  };

  async function enviar(e?: FormEvent) {
    e?.preventDefault();
    if (!texto.trim()) return;
    setOcupado(true);
    const r = await api<{ menciones: string[] }>(`/leads/${leadId}/notas`, { method: 'POST', body: JSON.stringify({ texto: texto.trim() }) });
    setOcupado(false);
    if (!r.data) return avisar(r.message ?? 'No se pudo guardar la nota', { tipo: 'error' });
    setTexto('');
    onCreada(r.data.menciones.length);
  }

  return (
    <form onSubmit={enviar} className="relative p-3">
      <Area
        ref={area}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={teclas}
        rows={3}
        maxLength={5000}
        placeholder="¿Qué hablaste con el cliente? Escribe @ para avisar a un compañero."
        aria-label="Nota"
        className="resize-y border-transparent focus:border-transparent focus:ring-0"
      />
      {sugerencias.length > 0 && (
        <ul className="absolute left-4 top-full z-20 -mt-2 w-64 overflow-hidden rounded-xl border border-linea bg-hoja py-1 shadow-flota" role="listbox">
          {sugerencias.map((m, i) => (
            <li key={m.id} role="option" aria-selected={i === sel}>
              <button type="button" onMouseDown={(e) => (e.preventDefault(), elegir(m))} className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${i === sel ? 'bg-papel' : ''}`}>
                <Avatar nombre={m.nombre} tam="size-7" />
                <span className="font-semibold">{m.nombre}</span>
                <span className="text-gris">@{m.username}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-end gap-3 px-1 pt-1">
        <span className="hidden text-xs text-gris-2 sm:inline">Ctrl + Enter para guardar</span>
        <Boton tam="sm" cargando={ocupado} disabled={!texto.trim()}>
          Guardar nota
        </Boton>
      </div>
    </form>
  );
}

function NuevaTarea({ lead, equipo, yo, onCreada }: { lead: Lead; equipo: Companero[]; yo: string; onCreada: (titulo: string) => void }) {
  const { avisar } = useAvisos();
  const [titulo, setTitulo] = useState('');
  const [vence, setVence] = useState(mananaALas10);
  const [responsable, setResponsable] = useState(yo);
  const [ocupado, setOcupado] = useState(false);
  // Solo quienes ven el lead pueden ser responsables: gerentes, su dueño, o cualquiera si no tiene dueño.
  const posibles = equipo.filter((m) => m.rol === 'gerente' || !lead.duenoId || lead.duenoId === m.id);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    const r = await api<Tarea>(`/leads/${lead.id}/tareas`, {
      method: 'POST',
      body: JSON.stringify({ titulo: titulo.trim(), venceEn: vence ? new Date(vence).toISOString() : null, responsableId: responsable }),
    });
    setOcupado(false);
    if (!r.data) return avisar(r.message ?? 'No se pudo crear la tarea', { tipo: 'error' });
    setTitulo('');
    onCreada(r.data.titulo);
  }

  return (
    <form onSubmit={enviar} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <Campo etiqueta="Qué hay que hacer" value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={200} placeholder="Llamar para cerrar el precio" />
      <Campo etiqueta="Para cuándo" type="datetime-local" value={vence} onChange={(e) => setVence(e.target.value)} />
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold">Responsable</span>
        <Selector value={responsable} onChange={(e) => setResponsable(e.target.value)}>
          {posibles.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id === yo ? 'Yo' : m.nombre}
            </option>
          ))}
        </Selector>
      </label>
      <div className="flex justify-end sm:col-span-3">
        <Boton tam="sm" cargando={ocupado} disabled={!titulo.trim()}>
          Crear tarea
        </Boton>
      </div>
    </form>
  );
}
