'use client';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { Mensaje } from '@/lib/bandeja';

interface Plantilla {
  nombre: string;
  idioma: string;
  categoria: string;
  texto: string;
  variables: number;
}

// Fuera de la ventana de 24 h WhatsApp solo deja escribir con una plantilla aprobada por Meta.
export default function Plantillas({ conversacionId, onEnviado }: { conversacionId: string; onEnviado: (m: Mensaje) => void }) {
  const [lista, setLista] = useState<Plantilla[] | null>(null);
  const [elegida, setElegida] = useState<Plantilla | null>(null);
  const [valores, setValores] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function abrir() {
    const r = await api<Plantilla[]>(`/conversaciones/${conversacionId}/plantillas`);
    if (!r.data) return setError(r.message ?? 'No se pudieron cargar las plantillas');
    setLista(r.data);
  }

  function elegir(p: Plantilla) {
    setElegida(p);
    setValores(Array(p.variables).fill(''));
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!elegida) return;
    setEnviando(true);
    const r = await api<Mensaje>(`/conversaciones/${conversacionId}/plantilla`, {
      method: 'POST',
      body: JSON.stringify({ nombre: elegida.nombre, idioma: elegida.idioma, parametros: valores }),
    });
    setEnviando(false);
    if (!r.data) return setError(r.message ?? 'No se pudo enviar');
    setError('');
    setElegida(null);
    setLista(null);
    onEnviado(r.data);
  }

  const vista = elegida?.texto.replace(/\{\{(\d+)\}\}/g, (_, i) => valores[Number(i) - 1] || `[${i}]`);

  if (!lista)
    return (
      <div className="mt-2">
        <button onClick={abrir} className="rounded-xl bg-tinta px-4 py-2 text-sm font-semibold text-white">
          Usar una plantilla
        </button>
        {error && <p className="mt-1 text-peligro">{error}</p>}
      </div>
    );

  return (
    <div className="mt-3 space-y-2">
      {lista.length === 0 ? (
        <p className="text-gris">No tienes plantillas aprobadas. Créalas en el administrador de WhatsApp de Meta.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {lista.map((p) => (
            <button
              key={p.nombre + p.idioma}
              onClick={() => elegir(p)}
              className={`rounded-full border px-3 py-1 ${elegida === p ? 'border-tinta bg-tinta text-white' : 'border-linea bg-white'}`}
            >
              {p.nombre.replaceAll('_', ' ')}
            </button>
          ))}
        </div>
      )}
      {elegida && (
        <form onSubmit={enviar} className="space-y-2 rounded-xl bg-white p-3">
          <p className="whitespace-pre-line text-tinta">{vista}</p>
          {valores.map((v, i) => (
            <input
              key={i}
              required
              maxLength={1000}
              value={v}
              onChange={(e) => setValores(valores.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={`Valor de {{${i + 1}}}`}
              aria-label={`Valor de la variable ${i + 1}`}
              className="w-full rounded-xl border border-linea px-3 py-2"
            />
          ))}
          <button disabled={enviando} className="rounded-xl bg-mango px-4 py-2 font-semibold text-tinta disabled:opacity-50">
            {enviando ? 'Enviando…' : 'Enviar plantilla'}
          </button>
        </form>
      )}
      {error && <p className="text-peligro">{error}</p>}
    </div>
  );
}
