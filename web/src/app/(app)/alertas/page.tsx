'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useMiembro } from '@/lib/miembro-ctx';

const TIPOS: { tipo: string; titulo: string; texto: string; gerente?: boolean }[] = [
  { tipo: 'lead_asignado', titulo: 'Lead asignado', texto: 'La IA te pasa un cliente que pidió hablar con una persona.' },
  { tipo: 'demo_agendada', titulo: 'Demo agendada', texto: 'La IA agendó una demo en tu calendario.' },
  { tipo: 'demo_pronto', titulo: 'Demo en 30 minutos', texto: 'Aviso antes de cada demo.' },
  { tipo: 'sin_atender', titulo: 'Cliente sin atender', texto: 'Un cliente escribió y nadie le responde.' },
  { tipo: 'seguimiento', titulo: 'Toca hacer seguimiento', texto: 'Cuando no hay plantilla, te avisamos para que escribas tú.' },
  { tipo: 'mencion', titulo: 'Te mencionaron', texto: 'Un compañero escribió @tu-usuario en una nota.' },
  { tipo: 'tarea_asignada', titulo: 'Tarea asignada', texto: 'Alguien te dejó una tarea en un lead.' },
  { tipo: 'tarea_vencida', titulo: 'Tarea vencida', texto: 'Una tarea tuya pasó su fecha sin hacerse.' },
  { tipo: 'pregunta', titulo: 'La IA no supo algo', texto: 'Una pregunta que conviene agregar a la base de conocimiento.' },
  { tipo: 'resumen_diario', titulo: 'Resumen diario', texto: 'A las 8:00, cómo va el día.', gerente: true },
];

// Cada miembro elige qué alertas recibe (en ARM y, si tiene celular de alertas, por WhatsApp).
export default function Alertas() {
  const { miembro } = useMiembro();
  const [off, setOff] = useState<string[] | null>(null);
  const [estado, setEstado] = useState('');

  useEffect(() => {
    api<{ alertasOff: string[] }>('/alertas/preferencias').then((r) => setOff(r.data?.alertasOff ?? []));
  }, []);

  async function alternar(tipo: string) {
    if (!off) return;
    const nuevo = off.includes(tipo) ? off.filter((t) => t !== tipo) : [...off, tipo];
    setOff(nuevo);
    const r = await api('/alertas/preferencias', { method: 'PUT', body: JSON.stringify({ alertasOff: nuevo }) });
    setEstado(r.status >= 400 ? (r.message ?? 'No se pudo guardar') : 'Guardado');
  }

  return (
    <section className="mx-auto max-w-2xl space-y-5 px-4 py-6 md:px-8 md:py-10">
      <header>
        <h1 className="font-display text-3xl font-bold">Alertas</h1>
        <p className="mt-1 text-gris">
          Elige qué avisos quieres recibir.
          {miembro.celularAlertas ? ` También llegan por WhatsApp al ${miembro.celularAlertas}.` : ' Si el gerente registra tu celular de alertas, también llegan por WhatsApp.'}
        </p>
      </header>
      {!off ? (
        <p className="text-gris">Cargando…</p>
      ) : (
        <ul className="divide-y divide-linea rounded-2xl border border-linea bg-white">
          {TIPOS.filter((t) => !t.gerente || miembro.rol === 'gerente').map((t) => (
            <li key={t.tipo}>
              <label className="flex cursor-pointer items-center gap-4 p-4">
                <span className="flex-1">
                  <span className="block font-medium">{t.titulo}</span>
                  <span className="block text-sm text-gris">{t.texto}</span>
                </span>
                <input type="checkbox" role="switch" checked={!off.includes(t.tipo)} onChange={() => alternar(t.tipo)} className="size-5 accent-menta" />
              </label>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-gris" aria-live="polite">
        {estado}
      </p>
    </section>
  );
}
