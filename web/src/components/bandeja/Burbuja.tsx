'use client';
import { useEffect, useState } from 'react';
import { urlDeArchivo } from '@/lib/api';
import { Mensaje, textoDeMensaje } from '@/lib/bandeja';

export const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

const ESTILO: Record<Mensaje['origen'], { caja: string; etiqueta?: string }> = {
  cliente: { caja: 'self-start rounded-bl-md bg-white' },
  humano: { caja: 'self-end rounded-br-md bg-uva text-white' },
  ia: { caja: 'self-end rounded-br-md bg-menta-suave', etiqueta: 'IA' },
  app_celular: { caja: 'self-end rounded-br-md bg-tinta-2 text-white', etiqueta: 'Desde el celular' },
  sistema: { caja: 'self-end rounded-br-md bg-mango-suave', etiqueta: 'Automático' },
};

export default function Burbuja({ m }: { m: Mensaje }) {
  const e = ESTILO[m.origen];
  const audio = m.tipo === 'audio' || m.tipo === 'voice';
  return (
    <div className={`entra max-w-[85%] rounded-2xl px-3.5 py-2 shadow-[0_1px_0_rgba(29,38,69,0.06)] md:max-w-[70%] ${e.caja}`}>
      {e.etiqueta && <p className="mb-0.5 text-[11px] font-semibold opacity-70">{e.etiqueta}</p>}
      {m.mediaId && <Archivo m={m} />}
      {audio && m.texto ? (
        <p className="whitespace-pre-wrap break-words text-sm">
          <span className="font-semibold opacity-70">Transcripción: </span>
          {m.texto}
        </p>
      ) : (
        (!m.mediaId || m.texto) && (
          <p className={`whitespace-pre-wrap break-words ${m.texto === null ? 'italic opacity-70' : ''}`}>{textoDeMensaje(m)}</p>
        )
      )}
      <p className="mt-0.5 text-right text-[11px] opacity-60">{hora(m.createdAt)}</p>
    </div>
  );
}

// Imágenes se cargan solas; audio, video y documentos se bajan al pedirlos (vienen de Meta, no de ARM).
function Archivo({ m }: { m: Mensaje }) {
  const imagen = m.tipo === 'image' || m.tipo === 'sticker';
  const [url, setUrl] = useState<string | null>(null);
  const [estado, setEstado] = useState<'listo' | 'cargando' | 'error'>(imagen ? 'cargando' : 'listo');

  async function cargar() {
    setEstado('cargando');
    const u = await urlDeArchivo(`/mensajes/${m.id}/media`);
    setUrl(u);
    setEstado(u ? 'listo' : 'error');
    return u;
  }

  useEffect(() => {
    if (imagen) void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.id]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);

  if (estado === 'error') return <p className="text-sm italic opacity-70">No se pudo cargar el archivo</p>;
  if (imagen)
    return url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="Imagen del cliente" className="mb-1 max-h-72 rounded-xl object-contain" />
    ) : (
      <div className="mb-1 h-40 w-56 animate-pulse rounded-xl bg-black/5" />
    );
  if (url && (m.tipo === 'audio' || m.tipo === 'voice')) return <audio controls autoPlay src={url} className="mb-1 h-10 max-w-full" />;
  if (url && m.tipo === 'video') return <video controls src={url} className="mb-1 max-h-72 rounded-xl" />;
  return (
    <button
      onClick={async () => {
        const u = url ?? (await cargar());
        if (u && m.tipo !== 'audio' && m.tipo !== 'voice' && m.tipo !== 'video') window.open(u, '_blank');
      }}
      disabled={estado === 'cargando'}
      className="mb-1 rounded-lg bg-black/5 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
    >
      {estado === 'cargando'
        ? 'Cargando…'
        : m.tipo === 'audio' || m.tipo === 'voice'
          ? '▶ Escuchar audio'
          : m.tipo === 'video'
            ? '▶ Ver video'
            : 'Abrir documento'}
    </button>
  );
}
