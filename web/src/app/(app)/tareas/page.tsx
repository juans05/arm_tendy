'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAvisos } from '@/components/Avisos';
import { IconoCheck, IconoChispa, IconoTareas } from '@/components/Iconos';
import { ChipEtapa, Encabezado, Vacio } from '@/components/ui';
import { api } from '@/lib/api';
import { Tarea, vencimiento } from '@/lib/actividad';
import { cargarEquipo, Companero } from '@/lib/equipo';
import { useMiembro } from '@/lib/miembro-ctx';

type Grupo = { titulo: string; tareas: Tarea[]; urgente?: boolean };

/** Pendientes en el orden en que hay que atenderlas. */
function agrupar(ts: Tarea[]): Grupo[] {
  const ahora = new Date();
  const finDeHoy = new Date(ahora).setHours(23, 59, 59, 999);
  const g: Grupo[] = [
    { titulo: 'Vencidas', tareas: [], urgente: true },
    { titulo: 'Hoy', tareas: [] },
    { titulo: 'Próximas', tareas: [] },
    { titulo: 'Sin fecha', tareas: [] },
  ];
  for (const t of ts) {
    const v = t.venceEn ? new Date(t.venceEn).getTime() : null;
    g[v === null ? 3 : v < ahora.getTime() ? 0 : v <= finDeHoy ? 1 : 2].tareas.push(t);
  }
  return g.filter((x) => x.tareas.length);
}

export default function Tareas() {
  const { miembro } = useMiembro();
  const gerente = miembro.rol === 'gerente';
  const { avisar } = useAvisos();
  const [estado, setEstado] = useState<'pendiente' | 'hecha'>('pendiente');
  const [todas, setTodas] = useState(false);
  const [tareas, setTareas] = useState<Tarea[] | null>(null);
  const [equipo, setEquipo] = useState<Companero[]>([]);

  const cargar = useCallback(
    () => api<Tarea[]>(`/tareas?estado=${estado}${todas ? '&todas=true' : ''}`).then((r) => setTareas(r.data ?? [])),
    [estado, todas],
  );
  useEffect(() => {
    setTareas(null);
    void cargar();
  }, [cargar]);
  useEffect(() => {
    cargarEquipo().then(setEquipo);
  }, []);

  async function alternar(t: Tarea) {
    const nuevo = t.estado === 'hecha' ? 'pendiente' : 'hecha';
    // Se quita de la lista al instante; si falla, vuelve.
    setTareas((ts) => ts?.filter((x) => x.id !== t.id) ?? ts);
    const r = await api(`/tareas/${t.id}`, { method: 'PATCH', body: JSON.stringify({ estado: nuevo }) });
    if (r.status !== 200) {
      void cargar();
      return avisar(r.message ?? 'No se pudo actualizar la tarea', { tipo: 'error' });
    }
    avisar(nuevo === 'hecha' ? `Hecha: ${t.titulo}` : `Reabierta: ${t.titulo}`, {
      deshacer: () => void api(`/tareas/${t.id}`, { method: 'PATCH', body: JSON.stringify({ estado: t.estado }) }).then(cargar),
    });
  }

  const vencidas = tareas?.filter((t) => vencimiento(t.venceEn)?.vencida).length ?? 0;
  const grupos: Grupo[] = estado === 'pendiente' ? agrupar(tareas ?? []) : [{ titulo: 'Hechas hace poco', tareas: tareas ?? [] }];
  const nombre = (id: string) => (id === miembro.id ? 'Tú' : (equipo.find((m) => m.id === id)?.nombre ?? 'Alguien'));

  return (
    <section className="mx-auto max-w-3xl pb-16">
      <Encabezado
        titulo={todas ? 'Tareas del equipo' : 'Mis tareas'}
        texto={
          estado === 'pendiente' && tareas
            ? vencidas
              ? `${vencidas} ${vencidas === 1 ? 'vencida' : 'vencidas'}: empieza por ahí.`
              : tareas.length
                ? 'Al día. Nada vencido.'
                : undefined
            : undefined
        }
      />
      <div className="flex flex-wrap items-center gap-2 px-4 md:px-8">
        <div className="inline-flex rounded-[10px] border border-linea bg-hoja p-0.5" role="tablist">
          {(['pendiente', 'hecha'] as const).map((e) => (
            <button key={e} role="tab" aria-selected={estado === e} onClick={() => setEstado(e)} className={`rounded-lg px-3 py-1.5 text-sm ${estado === e ? 'bg-tinta font-semibold text-white' : 'text-gris hover:text-tinta'}`}>
              {e === 'pendiente' ? 'Por hacer' : 'Hechas'}
            </button>
          ))}
        </div>
        {gerente && (
          <label className="ml-auto flex items-center gap-2 text-sm text-gris">
            <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} className="size-4 accent-tinta" />
            Ver las de todo el equipo
          </label>
        )}
      </div>

      <div className="mt-6 space-y-8 px-4 md:px-8">
        {tareas === null && <div className="h-40 animate-pulse rounded-2xl bg-hoja" />}
        {tareas?.length === 0 && (
          <Vacio
            icono={<IconoTareas />}
            titulo={estado === 'pendiente' ? 'No tienes nada pendiente' : 'Aún no completas tareas'}
            texto={estado === 'pendiente' ? 'Crea tareas desde la ficha de cada lead. Algunas llegan solas: cuando un cliente no asiste a la demo o cuando ganas una venta.' : undefined}
          />
        )}
        {grupos.map((g) => (
          <div key={g.titulo}>
            <h2 className="mb-2 flex items-baseline gap-2 font-display text-lg font-bold">
              <span className={g.urgente ? 'marcador' : ''}>{g.titulo}</span>
              <span className="tabular text-sm font-normal text-gris">{g.tareas.length}</span>
            </h2>
            <ul className="divide-y divide-linea overflow-hidden rounded-2xl border border-linea bg-hoja shadow-hoja">
              {g.tareas.map((t) => {
                const v = vencimiento(t.venceEn);
                return (
                  <li key={t.id} className="entra flex items-start gap-3 px-4 py-3">
                    <button
                      onClick={() => alternar(t)}
                      role="checkbox"
                      aria-checked={t.estado === 'hecha'}
                      aria-label={t.estado === 'hecha' ? `Reabrir ${t.titulo}` : `Marcar hecha: ${t.titulo}`}
                      className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2 transition ${t.estado === 'hecha' ? 'border-menta bg-menta text-white' : 'border-linea-2 hover:border-tinta'}`}
                    >
                      {t.estado === 'hecha' && <IconoCheck className="size-3.5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {t.titulo}
                        {t.origen === 'auto' && (
                          <span className="ml-2 inline-flex translate-y-[-1px] items-center gap-1 rounded-full bg-menta-suave px-2 py-0.5 align-middle text-[11px] font-semibold text-menta" title="La creó una automatización">
                            <IconoChispa className="size-3" /> Automática
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gris">
                        {t.lead && (
                          <Link href={`/leads/${t.leadId}`} className="font-medium text-tinta underline decoration-linea-2 underline-offset-4 hover:decoration-tinta">
                            {t.lead.contacto?.nombre ?? 'Lead'}
                          </Link>
                        )}
                        {t.lead && <ChipEtapa etapa={t.lead.etapa} />}
                        {todas && <span>{nombre(t.responsableId)}</span>}
                      </p>
                    </div>
                    {v && estado === 'pendiente' && (
                      <span className={`shrink-0 text-right text-sm ${v.vencida ? 'font-semibold text-mango-oscuro' : 'text-gris'}`}>{v.texto}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
