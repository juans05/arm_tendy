'use client';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { IconoBasura, IconoLibro, IconoSubir } from '@/components/Iconos';
import { api, subir } from '@/lib/api';
import { useMiembro } from '@/lib/miembro-ctx';

interface Doc {
  id: string;
  titulo: string;
  tipo: 'texto' | 'docx' | 'xlsx' | 'pdf' | 'imagen';
  texto: string;
  createdAt: string;
}
interface Pregunta {
  id: string;
  conversacionId: string | null;
  pregunta: string;
  respuesta: string | null;
  estado: 'abierta' | 'respondida' | 'aprobada' | 'descartada';
  createdAt: string;
}

const TIPO: Record<Doc['tipo'], string> = { texto: 'Texto', docx: 'Word', xlsx: 'Excel', pdf: 'PDF', imagen: 'Imagen' };

export default function Conocimiento() {
  const { miembro } = useMiembro();
  const gerente = miembro.rol === 'gerente';
  const [pestana, setPestana] = useState<'docs' | 'preguntas'>('docs');
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);

  const cargarDocs = useCallback(() => api<Doc[]>('/conocimiento').then((r) => setDocs(r.data ?? [])), []);
  const cargarPreguntas = useCallback(() => api<Pregunta[]>('/preguntas').then((r) => r.data && setPreguntas(r.data)), []);
  useEffect(() => {
    cargarDocs();
    cargarPreguntas();
  }, [cargarDocs, cargarPreguntas]);

  const pendientes = preguntas.filter((p) => p.estado === 'abierta' || p.estado === 'respondida').length;

  return (
    <section className="mx-auto max-w-4xl space-y-5 px-4 py-6 md:px-8 md:py-10">
      <header>
        <h1 className="font-display text-3xl font-bold">Base de conocimiento</h1>
        <p className="mt-1 text-gris">
          Lo que la IA sabe para vender. Precios, funciones y condiciones solo salen de aquí; si algo falta, la IA lo deja como pregunta.
        </p>
      </header>

      <div className="flex gap-2" role="tablist">
        <button
          role="tab"
          aria-selected={pestana === 'docs'}
          onClick={() => setPestana('docs')}
          className={`rounded-full px-4 py-2 text-sm ${pestana === 'docs' ? 'bg-tinta text-white' : 'bg-white text-gris'}`}
        >
          Documentos
        </button>
        <button
          role="tab"
          aria-selected={pestana === 'preguntas'}
          onClick={() => setPestana('preguntas')}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm ${pestana === 'preguntas' ? 'bg-tinta text-white' : 'bg-white text-gris'}`}
        >
          Preguntas sin respuesta
          {pendientes > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-mango px-1.5 text-xs font-bold text-tinta">{pendientes}</span>}
        </button>
      </div>

      {pestana === 'docs' ? (
        <Documentos docs={docs} gerente={gerente} recargar={cargarDocs} />
      ) : (
        <Preguntas preguntas={preguntas} gerente={gerente} recargar={() => Promise.all([cargarPreguntas(), cargarDocs()])} />
      )}
    </section>
  );
}

function Documentos({ docs, gerente, recargar }: { docs: Doc[] | null; gerente: boolean; recargar: () => void }) {
  const [modo, setModo] = useState<'nada' | 'texto'>('nada');
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const archivo = useRef<HTMLInputElement>(null);

  async function guardarTexto(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    const r = await api('/conocimiento/texto', { method: 'POST', body: JSON.stringify({ titulo, texto }) });
    setOcupado(false);
    if (r.status >= 400) return setError(r.message ?? 'No se pudo guardar');
    setTitulo('');
    setTexto('');
    setModo('nada');
    setError('');
    recargar();
  }

  async function subirArchivo(f: File) {
    setOcupado(true);
    setError('');
    const form = new FormData();
    form.append('archivo', f);
    const r = await subir('/conocimiento/archivo', form);
    setOcupado(false);
    if (archivo.current) archivo.current.value = '';
    if (r.status >= 400) return setError(r.message ?? 'No se pudo leer el archivo');
    recargar();
  }

  async function borrar(d: Doc) {
    if (!window.confirm(`¿Borrar "${d.titulo}"? La IA dejará de usarlo.`)) return;
    const r = await api(`/conocimiento/${d.id}`, { method: 'DELETE' });
    if (r.status >= 400) setError(r.message ?? 'No se pudo borrar');
    recargar();
  }

  return (
    <div className="space-y-4">
      {gerente && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setModo(modo === 'texto' ? 'nada' : 'texto')} className="rounded-xl bg-tinta px-4 py-2.5 text-sm font-semibold text-white">
            Escribir texto
          </button>
          <label className={`flex cursor-pointer items-center gap-2 rounded-xl bg-mango px-4 py-2.5 text-sm font-semibold text-tinta ${ocupado ? 'opacity-50' : ''}`}>
            <IconoSubir className="size-4" />
            {ocupado ? 'Leyendo…' : 'Subir archivo'}
            <input
              ref={archivo}
              type="file"
              className="sr-only"
              disabled={ocupado}
              accept=".docx,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.webp"
              onChange={(e) => e.target.files?.[0] && subirArchivo(e.target.files[0])}
            />
          </label>
          <p className="w-full text-xs text-gris">Word, Excel, PDF o imágenes (PNG, JPG) de hasta 10 MB. De las imágenes la IA lee el texto y luego puede enviarlas.</p>
        </div>
      )}

      {modo === 'texto' && (
        <form onSubmit={guardarTexto} className="space-y-3 rounded-2xl border border-linea bg-white p-4">
          <label className="block text-sm font-medium">
            Título
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} required maxLength={200} className="mt-1 w-full rounded-xl border border-linea px-3 py-2" />
          </label>
          <label className="block text-sm font-medium">
            Contenido
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              required
              rows={8}
              placeholder="Ej.: Planes: Básico S/ 99 al mes (1 sede). Pro S/ 199 (hasta 3 sedes). Incluye soporte por WhatsApp de 9 a 6."
              className="mt-1 w-full rounded-xl border border-linea px-3 py-2"
            />
          </label>
          <button disabled={ocupado} className="rounded-xl bg-tinta px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Guardar
          </button>
        </form>
      )}

      {error && <p className="text-sm text-peligro">{error}</p>}

      {docs === null ? (
        <p className="text-sm text-gris">Cargando…</p>
      ) : docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-linea bg-white p-10 text-center">
          <IconoLibro className="mx-auto mb-3 size-10 text-mango" />
          <p className="font-display text-lg font-semibold">La IA todavía no sabe nada de tu producto</p>
          <p className="mt-1 text-sm text-gris">
            {gerente ? 'Sube tu lista de precios, una presentación o escribe las preguntas frecuentes.' : 'Pide al gerente que suba la información del producto.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-linea rounded-2xl border border-linea bg-white">
          {docs.map((d) => (
            <li key={d.id} className="flex items-start gap-3 p-4">
              <span className="mt-0.5 rounded-lg bg-uva-suave px-2 py-0.5 text-xs font-semibold text-uva">{TIPO[d.tipo]}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{d.titulo}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-gris">{d.texto}</p>
              </div>
              {gerente && (
                <button onClick={() => borrar(d)} className="rounded-lg p-1.5 text-gris hover:bg-papel hover:text-peligro" title="Borrar">
                  <IconoBasura className="size-4" />
                  <span className="sr-only">Borrar {d.titulo}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Preguntas({ preguntas, gerente, recargar }: { preguntas: Pregunta[]; gerente: boolean; recargar: () => Promise<unknown> }) {
  const visibles = preguntas.filter((p) => p.estado === 'abierta' || p.estado === 'respondida');
  if (!visibles.length)
    return <p className="rounded-2xl bg-white p-8 text-center text-gris">No hay preguntas pendientes. Cuando la IA no sepa algo, aparecerá aquí.</p>;
  return (
    <ul className="space-y-3">
      {visibles.map((p) => (
        <TarjetaPregunta key={p.id} p={p} gerente={gerente} recargar={recargar} />
      ))}
    </ul>
  );
}

function TarjetaPregunta({ p, gerente, recargar }: { p: Pregunta; gerente: boolean; recargar: () => Promise<unknown> }) {
  const [respuesta, setRespuesta] = useState(p.respuesta ?? '');
  const [error, setError] = useState('');

  async function accion(ruta: string, init: RequestInit) {
    const r = await api(ruta, init);
    if (r.status >= 400) return setError(r.message ?? 'No se pudo guardar');
    setError('');
    await recargar();
  }

  return (
    <li className="rounded-2xl border border-linea bg-white p-4">
      <p className="font-medium">{p.pregunta}</p>
      <p className="text-xs text-gris">
        {new Date(p.createdAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}
        {p.conversacionId && (
          <>
            {', '}
            <a href={`/bandeja?c=${p.conversacionId}`} className="underline">
              ver conversación
            </a>
          </>
        )}
      </p>
      <textarea
        value={respuesta}
        onChange={(e) => setRespuesta(e.target.value)}
        rows={2}
        placeholder="Escribe la respuesta correcta"
        className="mt-3 w-full rounded-xl border border-linea px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-peligro">{error}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          disabled={!respuesta.trim()}
          onClick={() => accion(`/preguntas/${p.id}/respuesta`, { method: 'PUT', body: JSON.stringify({ respuesta }) })}
          className="rounded-xl border border-linea px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
        >
          Guardar respuesta
        </button>
        {gerente && p.estado === 'respondida' && (
          <button onClick={() => accion(`/preguntas/${p.id}/aprobar`, { method: 'POST' })} className="rounded-xl bg-menta px-3 py-1.5 text-sm font-semibold text-white">
            Aprobar: que la IA lo aprenda
          </button>
        )}
        {gerente && (
          <button onClick={() => accion(`/preguntas/${p.id}/descartar`, { method: 'POST' })} className="px-2 py-1.5 text-sm text-gris underline">
            Descartar
          </button>
        )}
      </div>
    </li>
  );
}
