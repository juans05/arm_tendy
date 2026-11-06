'use client';
import { FormEvent, useEffect, useState } from 'react';
import ConectarWhatsapp, { ConfigMeta } from '@/components/ConectarWhatsapp';
import CuentaAnuncios from '@/components/CuentaAnuncios';
import { IconoCanales } from '@/components/Iconos';
import { api } from '@/lib/api';
import { useMiembro } from '@/lib/miembro-ctx';

interface Numero {
  id: string;
  telefono: string;
  nombreVerificado: string | null;
  coexistencia: boolean;
  activo: boolean;
}

export default function Canales() {
  const { miembro } = useMiembro();
  const [numeros, setNumeros] = useState<Numero[] | null>(null);
  const [config, setConfig] = useState<ConfigMeta | null>(null);
  const [aviso, setAviso] = useState('');

  const cargar = () => api<Numero[]>('/canales').then((r) => setNumeros(r.data ?? []));
  useEffect(() => {
    cargar();
    api<ConfigMeta>('/canales/whatsapp/config').then((r) => r.data && setConfig(r.data));
  }, []);

  const conectado = (telefono: string) => {
    setAviso(`Listo: +${telefono} ya recibe mensajes en la bandeja.`);
    cargar();
  };

  if (miembro.rol !== 'gerente') return <p className="p-6 text-gris">Solo el gerente puede conectar canales.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 md:px-8 md:py-10">
      <header>
        <h1 className="font-display text-3xl font-bold">Canales</h1>
        <p className="mt-1 max-w-prose text-gris">Conecta el WhatsApp de ventas de tu empresa. Los mensajes de tus clientes llegarán a la bandeja de tu equipo.</p>
      </header>

      {aviso && <p className="rounded-xl bg-menta-suave px-4 py-3 text-sm font-medium text-tinta">{aviso}</p>}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Números conectados</h2>
        {numeros?.length === 0 && <p className="rounded-2xl border border-dashed border-linea bg-white p-5 text-sm text-gris">Aún no conectas ningún número.</p>}
        <ul className="space-y-2">
          {numeros?.map((n) => (
            <li key={n.id} className="flex items-center gap-4 rounded-2xl bg-white p-4">
              <span className="grid size-11 place-items-center rounded-[38%] bg-menta-suave text-menta">
                <IconoCanales />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">+{n.telefono}</p>
                <p className="truncate text-sm text-gris">
                  {n.nombreVerificado ?? 'WhatsApp Business'}
                  {n.coexistencia ? ', también en el celular' : ''}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${n.activo ? 'bg-menta-suave text-menta' : 'bg-papel text-gris'}`}>
                {n.activo ? 'Recibiendo' : 'Pausado'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Conectar WhatsApp</h2>
        {config === null ? null : config.configurado ? (
          <ConectarWhatsapp config={config} onConectado={conectado} />
        ) : (
          <p className="rounded-xl bg-mango-suave px-4 py-3 text-sm">La conexión con Facebook no está configurada en el servidor</p>
        )}
        <ConectarManual onConectado={conectado} />
      </section>

      <CuentaAnuncios />
    </div>
  );
}

// Para números que ya tienen un token de sistema de Meta (lo usa soporte).
function ConectarManual({ onConectado }: { onConectado: (telefono: string) => void }) {
  const [f, setF] = useState({ phoneNumberId: '', wabaId: '', token: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    const r = await api<{ telefono: string }>('/canales/whatsapp/conectar-existente', { method: 'POST', body: JSON.stringify(f) });
    setEnviando(false);
    if (r.data) {
      setF({ phoneNumberId: '', wabaId: '', token: '' });
      onConectado(r.data.telefono);
    } else setError(r.message ?? 'No se pudo conectar el número');
  }

  const campo = (k: keyof typeof f, etiqueta: string, tipo = 'text') => (
    <label className="block text-sm">
      {etiqueta}
      <input
        type={tipo}
        value={f[k]}
        onChange={(e) => setF({ ...f, [k]: e.target.value.trim() })}
        required
        className="mt-1 w-full rounded-xl border border-linea bg-papel px-3 py-2 outline-none focus:border-uva"
      />
    </label>
  );

  return (
    <details className="rounded-2xl bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold">Conectar número existente con sus datos de Meta</summary>
      <form onSubmit={enviar} className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {campo('phoneNumberId', 'ID del número (phone_number_id)')}
          {campo('wabaId', 'ID de la cuenta (WABA)')}
        </div>
        {campo('token', 'Token de acceso', 'password')}
        {error && <p className="text-sm text-peligro">{error}</p>}
        <button disabled={enviando} className="rounded-xl bg-tinta px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {enviando ? 'Conectando…' : 'Conectar número'}
        </button>
      </form>
    </details>
  );
}
