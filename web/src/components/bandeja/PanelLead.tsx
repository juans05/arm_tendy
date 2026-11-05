'use client';
import { ReactNode, useEffect, useState } from 'react';
import { IconoCerrar } from '@/components/Iconos';
import { api } from '@/lib/api';
import { ETAPAS, Lead } from '@/lib/bandeja';

export interface Ejecucion {
  id: string;
  tipo: string;
  modelo: string | null;
  tokensEntrada: number;
  tokensSalida: number;
  ms: number;
  salida: { texto?: string } | null;
  error: string | null;
  createdAt: string;
}

const COLOR_ETAPA: Partial<Record<Lead['etapa'], string>> = {
  ganado: 'bg-menta text-white',
  perdido: 'bg-peligro text-white',
  descartado: 'bg-linea text-gris',
  archivado: 'bg-linea text-gris',
  demo_agendada: 'bg-mango text-tinta',
};

// Panel lateral del chat: el lead que la IA va llenando y, en "Agente", qué hizo la IA y por qué.
export default function PanelLead({
  conversacionId,
  lead,
  onLead,
  onCerrar,
  acciones,
}: {
  conversacionId: string;
  lead: Lead | null;
  onLead: (l: Lead) => void;
  onCerrar: () => void;
  /** Bloque 4: controles del comercial (etapa, dueño, cierre). */
  acciones?: ReactNode;
}) {
  const [pestana, setPestana] = useState<'lead' | 'agente'>('lead');
  const [ejecuciones, setEjecuciones] = useState<Ejecucion[] | null>(null);

  useEffect(() => {
    api<Lead>(`/conversaciones/${conversacionId}/lead`).then((r) => r.data && onLead(r.data));
  }, [conversacionId, onLead]);

  useEffect(() => {
    if (pestana === 'agente')
      api<Ejecucion[]>(`/conversaciones/${conversacionId}/ejecuciones`).then((r) => setEjecuciones(r.data ?? []));
  }, [pestana, conversacionId, lead]);

  return (
    <aside className="flex h-full w-full flex-col bg-white">
      <div className="flex items-center gap-1 border-b border-linea px-3 pt-3">
        {(['lead', 'agente'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPestana(p)}
            className={`-mb-px border-b-2 px-3 pb-2.5 text-sm font-semibold ${pestana === p ? 'border-mango text-tinta' : 'border-transparent text-gris'}`}
          >
            {p === 'lead' ? 'Lead' : 'Agente'}
          </button>
        ))}
        <button onClick={onCerrar} className="ml-auto mb-2 rounded-lg p-1.5 text-gris hover:bg-papel" title="Cerrar panel">
          <IconoCerrar className="size-4" />
          <span className="sr-only">Cerrar panel</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {pestana === 'lead' ? (
          lead ? (
            <FichaLead lead={lead} acciones={acciones} />
          ) : (
            <p className="text-sm text-gris">Cargando…</p>
          )
        ) : (
          <Actividad ejecuciones={ejecuciones} />
        )}
      </div>
    </aside>
  );
}

function FichaLead({ lead, acciones }: { lead: Lead; acciones?: ReactNode }) {
  const datos = Object.entries(lead.datos);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${COLOR_ETAPA[lead.etapa] ?? 'bg-uva-suave text-uva'}`}>
          {ETAPAS[lead.etapa]}
        </span>
        {lead.calificado && <span className="rounded-full bg-menta-suave px-2.5 py-1 text-xs font-semibold text-menta">Calificado</span>}
        {lead.motivo && <span className="text-xs text-gris">Motivo: {lead.motivo}</span>}
      </div>

      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold">Interés</span>
          <span className="font-display text-lg font-bold">{lead.puntaje}</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-papel" role="meter" aria-valuenow={lead.puntaje} aria-valuemin={0} aria-valuemax={100} aria-label="Interés del lead">
          <div className="h-full rounded-full bg-mango transition-[width]" style={{ width: `${lead.puntaje}%` }} />
        </div>
      </div>

      {acciones}

      <section>
        <h3 className="text-sm font-semibold">Lo que sabemos</h3>
        {datos.length === 0 ? (
          <p className="mt-1 text-sm text-gris">La IA irá anotando aquí lo que el cliente cuente.</p>
        ) : (
          <dl className="mt-2 space-y-2.5">
            {datos.map(([k, d]) => (
              <div key={k}>
                <dt className="text-xs text-gris first-letter:uppercase">{k.replaceAll('_', ' ')}</dt>
                <dd className="text-sm font-medium">{d.valor}</dd>
                <dd className="mt-0.5 border-l-2 border-linea pl-2 text-xs italic text-gris">“{d.evidencia}”</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {lead.sugerencias.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold">Impresiones de la IA</h3>
          <p className="text-xs text-gris">No son datos confirmados.</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm">
            {lead.sugerencias.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="text-sm">
        <h3 className="font-semibold">Origen</h3>
        <p className="mt-1 text-gris">
          {lead.referral ? `Anuncio de Meta: ${lead.referral.headline ?? lead.referral.sourceId ?? 'sin título'}` : 'Sin anuncio (escribió directo)'}
        </p>
      </section>
    </div>
  );
}

const TIPO_EJECUCION: Record<string, string> = { agente: 'Respuesta', transcripcion: 'Transcripción', imagen: 'Lectura de imagen' };

function Actividad({ ejecuciones }: { ejecuciones: Ejecucion[] | null }) {
  if (!ejecuciones) return <p className="text-sm text-gris">Cargando…</p>;
  if (!ejecuciones.length) return <p className="text-sm text-gris">La IA todavía no intervino en esta conversación.</p>;
  return (
    <ol className="space-y-3">
      {ejecuciones.map((e) => {
        let decision: Record<string, unknown> | null = null;
        try {
          decision = e.salida?.texto && e.tipo === 'agente' ? JSON.parse(e.salida.texto.slice(e.salida.texto.indexOf('{'), e.salida.texto.lastIndexOf('}') + 1)) : null;
        } catch {
          decision = null;
        }
        return (
          <li key={e.id} className={`rounded-xl border p-3 text-sm ${e.error ? 'border-peligro/40 bg-peligro/5' : 'border-linea'}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{TIPO_EJECUCION[e.tipo] ?? e.tipo}</span>
              <span className="text-xs text-gris">
                {new Date(e.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {e.error ? (
              <p className="mt-1 text-peligro">Falló: {e.error}</p>
            ) : decision ? (
              <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-gris">Etapa</dt>
                <dd>{String(decision.etapa ?? '—')}</dd>
                <dt className="text-gris">Interés</dt>
                <dd>{String(decision.puntaje ?? '—')}</dd>
                {decision.traspaso ? (
                  <>
                    <dt className="text-gris">Traspaso</dt>
                    <dd>{decision.traspaso === 'molesto' ? 'Cliente molesto' : 'Pidió una persona'}</dd>
                  </>
                ) : null}
                {decision.pregunta_sin_respuesta ? (
                  <>
                    <dt className="text-gris">No supo</dt>
                    <dd>{String(decision.pregunta_sin_respuesta)}</dd>
                  </>
                ) : null}
              </dl>
            ) : (
              e.salida?.texto && <p className="mt-1 line-clamp-3 text-xs text-gris">{e.salida.texto}</p>
            )}
            <p className="mt-2 text-[11px] text-gris">
              {e.modelo}, {e.tokensEntrada + e.tokensSalida} tokens, {(e.ms / 1000).toFixed(1)} s
            </p>
          </li>
        );
      })}
    </ol>
  );
}
