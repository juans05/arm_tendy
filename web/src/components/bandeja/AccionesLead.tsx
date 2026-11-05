'use client';
import { FormEvent, useEffect, useState } from 'react';
import { api, Miembro } from '@/lib/api';
import { Etapa, ETAPAS, Lead } from '@/lib/bandeja';
import { useMiembro } from '@/lib/miembro-ctx';

// Etapas que el comercial mueve a mano (la IA mueve nuevo, en conversación y seguimiento).
const MANUALES: Etapa[] = ['en_conversacion', 'demo_agendada', 'demo_realizada', 'no_asistio', 'ganado', 'perdido', 'seguimiento', 'descartado'];

let equipo: Promise<Miembro[]> | null = null;
const cargarEquipo = () =>
  (equipo ??= api<Miembro[]>('/miembros').then((r) => (r.data ?? []).filter((m) => m.estado === 'activo')));

// Controles del lead en el panel del chat: etapa, cierre (monto/plan o motivo) y dueño.
export default function AccionesLead({ lead, onLead }: { lead: Lead; onLead: (l: Lead) => void }) {
  const { miembro } = useMiembro();
  const gerente = miembro.rol === 'gerente';
  const [etapa, setEtapa] = useState<Etapa>(lead.etapa);
  const [monto, setMonto] = useState(lead.monto?.toString() ?? '');
  const [plan, setPlan] = useState(lead.plan ?? '');
  const [motivo, setMotivo] = useState(lead.motivo ?? '');
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => setEtapa(lead.etapa), [lead.etapa]);
  useEffect(() => {
    if (gerente) cargarEquipo().then(setMiembros);
  }, [gerente]);

  async function guardar(cambios: Record<string, unknown>) {
    setOcupado(true);
    const r = await api<Lead>(`/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify(cambios) });
    setOcupado(false);
    if (!r.data) return setError(r.message ?? 'No se pudo guardar');
    setError('');
    onLead(r.data);
  }

  function cambiarEtapa(e: FormEvent) {
    e.preventDefault();
    const cambios: Record<string, unknown> = { etapa };
    if (etapa === 'ganado') Object.assign(cambios, { monto: Number(monto), plan: plan || null });
    if (etapa === 'perdido' || etapa === 'descartado') cambios.motivo = motivo;
    void guardar(cambios);
  }

  const cambio = etapa !== lead.etapa;
  return (
    <section className="space-y-3 rounded-2xl bg-papel p-3">
      <form onSubmit={cambiarEtapa} className="space-y-2">
        <label className="block text-xs font-semibold text-gris">
          Etapa
          <select
            value={etapa}
            onChange={(e) => setEtapa(e.target.value as Etapa)}
            className="mt-1 w-full rounded-xl border border-linea bg-white px-3 py-2 text-sm font-medium text-tinta"
          >
            {!MANUALES.includes(lead.etapa) && <option value={lead.etapa}>{ETAPAS[lead.etapa]}</option>}
            {MANUALES.map((x) => (
              <option key={x} value={x}>
                {ETAPAS[x]}
              </option>
            ))}
          </select>
        </label>
        {cambio && etapa === 'ganado' && (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-gris">
              Monto (S/)
              <input type="number" min={0} step="0.01" required value={monto} onChange={(e) => setMonto(e.target.value)} className="mt-1 w-full rounded-xl border border-linea bg-white px-3 py-2 text-sm text-tinta" />
            </label>
            <label className="text-xs font-semibold text-gris">
              Plan
              <input value={plan} maxLength={100} onChange={(e) => setPlan(e.target.value)} className="mt-1 w-full rounded-xl border border-linea bg-white px-3 py-2 text-sm text-tinta" />
            </label>
          </div>
        )}
        {cambio && (etapa === 'perdido' || etapa === 'descartado') && (
          <label className="block text-xs font-semibold text-gris">
            Motivo
            <input required maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: le pareció caro" className="mt-1 w-full rounded-xl border border-linea bg-white px-3 py-2 text-sm text-tinta" />
          </label>
        )}
        {cambio && (
          <button disabled={ocupado} className="w-full rounded-xl bg-tinta py-2 text-sm font-semibold text-white disabled:opacity-50">
            Mover a {ETAPAS[etapa]}
          </button>
        )}
      </form>

      {gerente ? (
        <label className="block text-xs font-semibold text-gris">
          Comercial a cargo
          <select
            value={lead.duenoId ?? ''}
            disabled={ocupado}
            onChange={(e) => guardar({ duenoId: e.target.value || null })}
            className="mt-1 w-full rounded-xl border border-linea bg-white px-3 py-2 text-sm font-medium text-tinta"
          >
            <option value="">Sin asignar</option>
            {miembros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>
      ) : !lead.duenoId ? (
        <button onClick={() => guardar({ duenoId: miembro.id })} disabled={ocupado} className="w-full rounded-xl border border-tinta py-2 text-sm font-semibold">
          Tomar este lead
        </button>
      ) : null}
      {error && <p className="text-sm text-peligro">{error}</p>}
    </section>
  );
}
