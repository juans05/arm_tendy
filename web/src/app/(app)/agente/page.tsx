'use client';
import { FormEvent, useEffect, useState } from 'react';
import { IconoChispa } from '@/components/Iconos';
import { api } from '@/lib/api';

interface Config {
  agenteModo: 'responde' | 'propone';
  agenteNombre: string;
  agenteTono: string;
  producto: string;
  seguimientoDias1: number;
  seguimientoDias2: number;
  minutosSinAtender: number;
  zonaHoraria: string;
  margenCitasMin: number;
  plantillaSeguimiento: string | null;
  plantillaRecordatorio: string | null;
  plantillaAlerta: string | null;
  idiomaPlantillas: string;
  iaActiva: boolean;
}

const MODOS = {
  responde: { titulo: 'Responde sola', texto: 'La IA contesta al instante y te pasa el lead cuando agenda la demo o el cliente pide una persona.' },
  propone: { titulo: 'Propone y tú envías', texto: 'La IA escribe un borrador y un comercial lo revisa y lo envía.' },
} as const;

export default function Agente() {
  const [c, setC] = useState<Config | null>(null);
  const [estado, setEstado] = useState<'' | 'guardando' | 'guardado'>('');
  const [error, setError] = useState('');

  useEffect(() => {
    api<Config>('/agente/config').then((r) => r.data && setC(r.data));
  }, []);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!c) return;
    setEstado('guardando');
    const { iaActiva: _, resumenEnviado: __, tenant: ___, ...datos } = c as Config & { resumenEnviado?: unknown; tenant?: unknown };
    void _;
    void __;
    void ___;
    const r = await api('/agente/config', { method: 'PUT', body: JSON.stringify(datos) });
    if (r.status >= 400) {
      setEstado('');
      return setError(r.message ?? 'No se pudo guardar');
    }
    setError('');
    setEstado('guardado');
    setTimeout(() => setEstado(''), 2000);
  }

  if (!c) return <p className="p-8 text-gris">Cargando…</p>;

  return (
    <form onSubmit={guardar} className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <header>
        <h1 className="font-display text-3xl font-bold">Agente y seguimiento</h1>
        <p className="mt-1 text-gris">Cómo atiende la IA tu WhatsApp de ventas. Los criterios de calificación se definen en cada línea de producto.</p>
      </header>

      {!c.iaActiva && (
        <p className="rounded-2xl bg-mango-suave p-4 text-sm">
          La IA no está configurada en el servidor (falta <code>AI_BASE_URL</code>). Mientras tanto ARM funciona como bandeja: tu equipo responde a mano.
        </p>
      )}

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 font-semibold">Modo</legend>
        {(Object.keys(MODOS) as Config['agenteModo'][]).map((m) => (
          <label
            key={m}
            className={`cursor-pointer rounded-2xl border-2 bg-white p-4 transition-colors ${c.agenteModo === m ? 'border-mango' : 'border-linea'}`}
          >
            <input type="radio" name="modo" className="sr-only" checked={c.agenteModo === m} onChange={() => setC({ ...c, agenteModo: m })} />
            <span className="flex items-center gap-2 font-semibold">
              <IconoChispa className="size-4 text-menta" />
              {MODOS[m].titulo}
            </span>
            <span className="mt-1 block text-sm text-gris">{MODOS[m].texto}</span>
          </label>
        ))}
      </fieldset>

      <div className="space-y-4 rounded-2xl border border-linea bg-white p-5">
        <label className="block text-sm font-medium">
          Nombre con el que se presenta
          <input value={c.agenteNombre} onChange={(e) => setC({ ...c, agenteNombre: e.target.value })} maxLength={60} required className="mt-1 w-full rounded-xl border border-linea px-3 py-2" />
        </label>
        <label className="block text-sm font-medium">
          Qué vendes, en dos o tres frases
          <textarea
            value={c.producto}
            onChange={(e) => setC({ ...c, producto: e.target.value })}
            rows={3}
            maxLength={5000}
            placeholder="Ej.: Wuarikes es un sistema para barberías, restaurantes y spas: reservas por WhatsApp, caja y reportes."
            className="mt-1 w-full rounded-xl border border-linea px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium">
          Tono
          <textarea
            value={c.agenteTono}
            onChange={(e) => setC({ ...c, agenteTono: e.target.value })}
            rows={2}
            maxLength={2000}
            placeholder="Ej.: Cercano y alegre, tutea, usa pocos emojis."
            className="mt-1 w-full rounded-xl border border-linea px-3 py-2"
          />
        </label>
      </div>

      <div className="space-y-4 rounded-2xl border border-linea bg-white p-5">
        <h2 className="font-semibold">Seguimiento y alertas</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium">
            Primer recordatorio (días)
            <input type="number" min={1} max={60} value={c.seguimientoDias1} onChange={(e) => setC({ ...c, seguimientoDias1: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-linea px-3 py-2" />
          </label>
          <label className="block text-sm font-medium">
            Segundo recordatorio (días)
            <input type="number" min={1} max={90} value={c.seguimientoDias2} onChange={(e) => setC({ ...c, seguimientoDias2: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-linea px-3 py-2" />
          </label>
          <label className="block text-sm font-medium">
            Lead sin atender tras (min)
            <input type="number" min={5} max={240} value={c.minutosSinAtender} onChange={(e) => setC({ ...c, minutosSinAtender: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-linea px-3 py-2" />
          </label>
        </div>
        <p className="text-xs text-gris">A quien dice &quot;todavía no&quot; se le escribe a los días indicados; si no responde a los recordatorios, el lead se archiva.</p>
      </div>

      <div className="space-y-4 rounded-2xl border border-linea bg-white p-5">
        <h2 className="font-semibold">Agenda</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Zona horaria
            <input value={c.zonaHoraria} onChange={(e) => setC({ ...c, zonaHoraria: e.target.value })} maxLength={50} list="zonas" className="mt-1 w-full rounded-xl border border-linea px-3 py-2" />
            <datalist id="zonas">
              {['America/Lima', 'America/Bogota', 'America/Mexico_City', 'America/Santiago', 'America/Argentina/Buenos_Aires', 'Europe/Madrid'].map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
          </label>
          <label className="block text-sm font-medium">
            Minutos libres entre demos
            <input type="number" min={0} max={120} value={c.margenCitasMin} onChange={(e) => setC({ ...c, margenCitasMin: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-linea px-3 py-2" />
          </label>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-linea bg-white p-5">
        <h2 className="font-semibold">Plantillas de WhatsApp</h2>
        <p className="text-sm text-gris">
          Pasadas 24 h desde el último mensaje del cliente, WhatsApp solo deja escribir con plantillas aprobadas por Meta. Escribe el nombre exacto de cada una (en minúsculas, con guion bajo). Si dejas vacío, ARM te avisa para que escribas tú.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ['plantillaSeguimiento', 'Seguimiento', 'Variable {{1}}: nombre del cliente'],
              ['plantillaRecordatorio', 'Recordatorio de demo', '{{1}} nombre, {{2}} fecha y hora'],
              ['plantillaAlerta', 'Alertas al equipo', '{{1}} título, {{2}} detalle'],
            ] as const
          ).map(([campo, titulo, ayuda]) => (
            <label key={campo} className="block text-sm font-medium">
              {titulo}
              <input
                value={c[campo] ?? ''}
                onChange={(e) => setC({ ...c, [campo]: e.target.value.trim() || null })}
                pattern="[a-z0-9_]+"
                maxLength={100}
                placeholder="nombre_de_plantilla"
                className="mt-1 w-full rounded-xl border border-linea px-3 py-2"
              />
              <span className="mt-1 block text-xs font-normal text-gris">{ayuda}</span>
            </label>
          ))}
          <label className="block text-sm font-medium">
            Idioma de las plantillas
            <input value={c.idiomaPlantillas} onChange={(e) => setC({ ...c, idiomaPlantillas: e.target.value })} maxLength={10} placeholder="es" className="mt-1 w-full rounded-xl border border-linea px-3 py-2" />
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-peligro">{error}</p>}
      <button disabled={estado === 'guardando'} className="rounded-xl bg-tinta px-5 py-2.5 font-semibold text-white disabled:opacity-50">
        {estado === 'guardado' ? 'Guardado' : estado === 'guardando' ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}
