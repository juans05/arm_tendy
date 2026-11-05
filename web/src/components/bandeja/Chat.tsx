'use client';
import { FormEvent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from 'react';
import Avatar from '@/components/Avatar';
import { IconoAtras, IconoChispa, IconoEnviar, IconoInfo, IconoPersona } from '@/components/Iconos';
import { api } from '@/lib/api';
import { ConversacionResumen, fueraDeVentana, Mensaje } from '@/lib/bandeja';
import Burbuja from './Burbuja';

function dia(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return 'Hoy';
  hoy.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function ChipModo({ modo, chico = false }: { modo: ConversacionResumen['modo']; chico?: boolean }) {
  const ia = modo === 'ia';
  const Icono = ia ? IconoChispa : IconoPersona;
  return (
    <span
      title={ia ? 'La IA atiende esta conversación' : 'Una persona atiende esta conversación'}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-medium ${chico ? 'p-0.5' : 'px-2.5 py-1 text-xs'} ${
        ia ? 'bg-menta-suave text-menta' : 'bg-uva-suave text-uva'
      }`}
    >
      <Icono className={chico ? 'size-3.5' : 'size-4'} />
      {!chico && (ia ? 'IA' : 'Persona')}
    </span>
  );
}

export default function Chat({
  conv,
  mensajes,
  onVolver,
  onEnviado,
  onPanel,
  extraComposer,
}: {
  conv: ConversacionResumen;
  mensajes: Mensaje[];
  onVolver: () => void;
  onEnviado: (m: Mensaje) => void;
  onPanel: () => void;
  /** Botón de plantillas (bloque 6) cuando la ventana de 24 h está cerrada. */
  extraComposer?: ReactNode;
}) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [devolviendo, setDevolviendo] = useState(false);
  const [error, setError] = useState('');
  const fondo = useRef<HTMLDivElement>(null);
  const [ahora, setAhora] = useState(() => new Date());
  const cerrada = fueraDeVentana(conv.ultimoEntranteEn, ahora);

  // La ventana de 24 h se cierra sola aunque no llegue nada nuevo.
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fondo.current?.scrollIntoView({ block: 'end' });
  }, [mensajes.length]);

  async function enviar(e?: FormEvent) {
    e?.preventDefault();
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setError('');
    const r = await api<Mensaje>(`/conversaciones/${conv.id}/mensajes`, { method: 'POST', body: JSON.stringify({ texto: t }) });
    setEnviando(false);
    if (r.data) {
      setTexto('');
      onEnviado(r.data);
    } else setError(r.message ?? 'No se pudo enviar el mensaje');
  }

  async function devolverIa() {
    setDevolviendo(true);
    const r = await api(`/conversaciones/${conv.id}/devolver-ia`, { method: 'POST' });
    setDevolviendo(false);
    if (r.status >= 400) setError(r.message ?? 'No se pudo devolver a la IA');
  }

  const alPresionar = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  return (
    <>
      <header className="flex shrink-0 items-center gap-3 border-b border-linea bg-white px-3 py-2.5 md:px-5">
        <button onClick={onVolver} className="rounded-lg p-1.5 text-gris hover:bg-papel md:hidden" title="Volver">
          <IconoAtras />
          <span className="sr-only">Volver a la bandeja</span>
        </button>
        <Avatar nombre={conv.contacto.nombre} semilla={conv.contacto.telefono || conv.id} tam="size-10" />
        <div className="min-w-0">
          <p className="truncate font-semibold">{conv.contacto.nombre}</p>
          {conv.contacto.telefono && <p className="text-xs text-gris">+{conv.contacto.telefono}</p>}
        </div>
        <span className="ml-auto flex items-center gap-2">
          <ChipModo modo={conv.modo} />
          {conv.modo === 'humano' && (
            <button
              onClick={devolverIa}
              disabled={devolviendo}
              className="hidden rounded-full border border-menta px-3 py-1 text-xs font-semibold text-menta hover:bg-menta-suave disabled:opacity-50 sm:inline-block"
            >
              Devolver a la IA
            </button>
          )}
          <button onClick={onPanel} className="rounded-lg p-1.5 text-gris hover:bg-papel" title="Ver lead">
            <IconoInfo />
            <span className="sr-only">Ver lead y actividad de la IA</span>
          </button>
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-8">
        <ol className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {mensajes.map((m, i) => {
            const nuevoDia = i === 0 || dia(mensajes[i - 1].createdAt) !== dia(m.createdAt);
            return (
              <li key={m.id} className="contents">
                {nuevoDia && (
                  <p className="my-3 self-center rounded-full bg-white px-3 py-1 text-xs text-gris first-letter:uppercase">{dia(m.createdAt)}</p>
                )}
                <Burbuja m={m} />
              </li>
            );
          })}
        </ol>
        <div ref={fondo} />
      </div>

      {conv.borrador && !cerrada && (
        <div className="shrink-0 border-t border-menta/30 bg-menta-suave px-3 py-2.5 md:px-5">
          <div className="mx-auto flex max-w-3xl items-start gap-3">
            <IconoChispa className="mt-0.5 size-4 shrink-0 text-menta" />
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-semibold">La IA propone: </span>
              {conv.borrador}
            </p>
            <button
              onClick={() => setTexto(conv.borrador ?? '')}
              className="shrink-0 rounded-lg bg-menta px-3 py-1.5 text-xs font-semibold text-white"
            >
              Usar
            </button>
          </div>
        </div>
      )}

      {cerrada ? (
        <div className="shrink-0 border-t border-linea bg-mango-suave px-5 py-3 text-sm">
          <p>Pasaron más de 24 h desde el último mensaje del cliente: WhatsApp solo permite escribirle con una plantilla aprobada.</p>
          {extraComposer}
        </div>
      ) : (
        <form onSubmit={enviar} className="shrink-0 border-t border-linea bg-white px-3 py-3 md:px-5">
          {error && <p className="mb-2 text-sm text-peligro">{error}</p>}
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={alPresionar}
              rows={1}
              maxLength={4096}
              placeholder={`Responder a ${conv.contacto.nombre.split(' ')[0]}`}
              className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-linea bg-papel px-4 py-2.5 outline-none [field-sizing:content] placeholder:text-gris focus:border-uva"
            />
            <button
              disabled={!texto.trim() || enviando}
              className="grid size-11 shrink-0 place-items-center rounded-2xl bg-mango text-tinta transition active:scale-95 disabled:opacity-40"
              title="Enviar"
            >
              <IconoEnviar />
              <span className="sr-only">Enviar</span>
            </button>
          </div>
          <p className="mx-auto mt-1.5 hidden max-w-3xl text-xs text-gris md:block">
            Enter envía. Shift + Enter hace un salto de línea. Al responder tú, la IA deja de contestar en este chat.
          </p>
        </form>
      )}
    </>
  );
}
