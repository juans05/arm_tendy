"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Avatar from "@/components/Avatar";
import {
  IconoAtras,
  IconoBandeja,
  IconoCelular,
  IconoChispa,
  IconoEnviar,
  IconoPersona,
} from "@/components/Iconos";
import { API, api } from "@/lib/api";
import {
  aplicarEvento,
  ConversacionResumen,
  EventoBandeja,
  fueraDeVentana,
  Mensaje,
  textoDeMensaje,
} from "@/lib/bandeja";
import { conectarEventos } from "@/lib/eventos";
import { useMiembro } from "@/lib/miembro-ctx";
import { leerToken } from "@/lib/sesion";

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });

function cuando(iso: string, ahora = new Date()) {
  const d = new Date(iso);
  const min = Math.floor((ahora.getTime() - d.getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `${min} min`;
  if (d.toDateString() === ahora.toDateString()) return hora(iso);
  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);
  if (d.toDateString() === ayer.toDateString()) return "ayer";
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

function dia(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  hoy.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function Bandeja() {
  const { miembro } = useMiembro();
  const router = useRouter();
  const [lista, setLista] = useState<ConversacionResumen[] | null>(null);
  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [filtro, setFiltro] = useState<"todas" | "sin-leer">("todas");
  const [busqueda, setBusqueda] = useState("");
  const abiertaRef = useRef<string | null>(null);
  abiertaRef.current = abiertaId;
  const listaRef = useRef(lista);
  listaRef.current = lista;

  const cargarLista = useCallback(
    () =>
      api<ConversacionResumen[]>("/conversaciones").then(
        (r) => r.data && setLista(r.data),
      ),
    [],
  );

  useEffect(() => {
    cargarLista();
    const recargarAbierta = () => {
      const id = abiertaRef.current;
      if (id)
        api<Mensaje[]>(`/conversaciones/${id}/mensajes`).then(
          (r) => r.data && abiertaRef.current === id && setMensajes(r.data),
        );
    };
    // Tiempo real: EventSource no admite cabeceras, el token va en la URL (solo esta ruta lo acepta).
    return conectarEventos<EventoBandeja>({
      url: () => {
        const t = leerToken();
        return t ? `${API}/eventos?token=${encodeURIComponent(t)}` : null;
      },
      onResync: () => {
        cargarLista();
        recargarAbierta();
      },
      onSinSesion: () => router.replace("/login"),
      onEvento: (ev) => {
        // Conversación nueva: se recarga la lista para traer el nombre del contacto.
        if (
          listaRef.current &&
          !listaRef.current.some((c) => c.id === ev.conversacionId)
        )
          cargarLista();
        setLista((l) => (l ? aplicarEvento(l, ev, abiertaRef.current) : l));
        if (ev.conversacionId === abiertaRef.current) {
          setMensajes((ms) =>
            ms.some((m) => m.id === ev.mensaje.id) ? ms : [...ms, ev.mensaje],
          );
          // ponytail: marcar como leído recargando los mensajes; un endpoint propio si pesa.
          if (ev.mensaje.direccion === "entrante")
            api(`/conversaciones/${ev.conversacionId}/mensajes`);
        }
      },
    });
  }, [cargarLista, router]);

  async function abrir(id: string) {
    setAbiertaId(id);
    setMensajes([]);
    setLista(
      (l) => l?.map((c) => (c.id === id ? { ...c, noLeidos: 0 } : c)) ?? l,
    );
    const r = await api<Mensaje[]>(`/conversaciones/${id}/mensajes`);
    if (r.data && abiertaRef.current === id) setMensajes(r.data);
  }

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (lista ?? []).filter(
      (c) =>
        (filtro === "todas" || c.noLeidos > 0) &&
        (!q ||
          c.contacto.nombre.toLowerCase().includes(q) ||
          c.contacto.telefono.includes(q)),
    );
  }, [lista, filtro, busqueda]);
  const sinLeer = (lista ?? []).filter((c) => c.noLeidos > 0).length;
  const abierta = lista?.find((c) => c.id === abiertaId) ?? null;

  return (
    <div className="flex h-full min-h-0">
      {/* Lista */}
      <section
        className={`min-h-0 w-full flex-col border-r border-linea bg-white md:flex md:w-[22rem] lg:w-[24rem] ${abiertaId ? "hidden" : "flex"}`}
      >
        <div className="space-y-3 border-b border-linea px-4 pb-3 pt-4">
          <div className="flex items-baseline justify-between">
            <h1 className="font-display text-2xl font-bold">Bandeja</h1>
            {sinLeer > 0 && (
              <span className="text-sm text-gris">
                {sinLeer === 1
                  ? "1 chat sin leer"
                  : `${sinLeer} chats sin leer`}
              </span>
            )}
          </div>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o número"
            className="w-full rounded-xl border border-linea bg-papel px-3.5 py-2.5 text-sm outline-none placeholder:text-gris focus:border-uva"
          />
          <div className="flex gap-2" role="tablist">
            {(["todas", "sin-leer"] as const).map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filtro === f}
                onClick={() => setFiltro(f)}
                className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${filtro === f ? "bg-tinta text-white" : "bg-papel text-gris hover:text-tinta"}`}
              >
                {f === "todas" ? "Todas" : "Sin leer"}
              </button>
            ))}
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {lista === null && <Esqueleto />}
          {lista?.length === 0 && <Vacia gerente={miembro.rol === "gerente"} />}
          {lista && lista.length > 0 && visibles.length === 0 && (
            <p className="p-6 text-center text-sm text-gris">
              Nada por aquí con ese filtro.
            </p>
          )}
          {visibles.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => abrir(c.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${c.id === abiertaId ? "bg-uva-suave" : "hover:bg-papel"}`}
              >
                <Avatar
                  nombre={c.contacto.nombre}
                  semilla={c.contacto.telefono || c.id}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p
                      className={`truncate ${c.noLeidos ? "font-bold" : "font-medium"}`}
                    >
                      {c.contacto.nombre}
                    </p>
                    <span
                      className={`ml-auto shrink-0 text-xs ${c.noLeidos ? "font-semibold text-tinta" : "text-gris"}`}
                    >
                      {cuando(c.ultimoMensajeEn)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <ChipModo modo={c.modo} chico />
                    <p
                      className={`truncate text-sm ${c.noLeidos ? "text-tinta" : "text-gris"}`}
                    >
                      {c.ultimoTexto ?? ""}
                    </p>
                    {c.noLeidos > 0 && (
                      <span className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-mango px-1.5 text-xs font-bold text-tinta">
                        {c.noLeidos > 99 ? "99+" : c.noLeidos}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Chat */}
      <section
        className={`min-h-0 min-w-0 flex-1 flex-col bg-papel ${abiertaId ? "flex" : "hidden md:flex"}`}
      >
        {abierta ? (
          <Chat
            key={abierta.id}
            conv={abierta}
            mensajes={mensajes}
            onVolver={() => setAbiertaId(null)}
            onEnviado={(m) => {
              setMensajes((ms) =>
                ms.some((x) => x.id === m.id) ? ms : [...ms, m],
              );
              setLista((l) =>
                l
                  ? aplicarEvento(
                      l,
                      {
                        tipo: "mensaje",
                        conversacionId: abierta.id,
                        mensaje: m,
                      },
                      abierta.id,
                    )
                  : l,
              );
            }}
          />
        ) : (
          <div className="m-auto max-w-xs p-8 text-center text-gris">
            <IconoBandeja className="mx-auto mb-3 size-10 text-linea" />
            <p className="font-display text-lg font-semibold text-tinta">
              Elige una conversación
            </p>
            <p className="mt-1 text-sm">
              Los mensajes nuevos aparecen solos, no hace falta recargar.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function Chat({
  conv,
  mensajes,
  onVolver,
  onEnviado,
}: {
  conv: ConversacionResumen;
  mensajes: Mensaje[];
  onVolver: () => void;
  onEnviado: (m: Mensaje) => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const fondo = useRef<HTMLDivElement>(null);
  const cerrada = fueraDeVentana(conv.ultimoEntranteEn, new Date());

  useEffect(() => {
    fondo.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length]);

  async function enviar(e?: FormEvent) {
    e?.preventDefault();
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setError("");
    const r = await api<Mensaje>(`/conversaciones/${conv.id}/mensajes`, {
      method: "POST",
      body: JSON.stringify({ texto: t }),
    });
    setEnviando(false);
    if (r.data) {
      setTexto("");
      onEnviado(r.data);
    } else setError(r.message ?? "No se pudo enviar el mensaje");
  }

  const alPresionar = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  return (
    <>
      <header className="flex shrink-0 items-center gap-3 border-b border-linea bg-white px-3 py-2.5 md:px-5">
        <button
          onClick={onVolver}
          className="rounded-lg p-1.5 text-gris hover:bg-papel md:hidden"
          title="Volver"
        >
          <IconoAtras />
          <span className="sr-only">Volver a la bandeja</span>
        </button>
        <Avatar
          nombre={conv.contacto.nombre}
          semilla={conv.contacto.telefono || conv.id}
          tam="size-10"
        />
        <div className="min-w-0">
          <p className="truncate font-semibold">{conv.contacto.nombre}</p>
          {conv.contacto.telefono && (
            <p className="text-xs text-gris">+{conv.contacto.telefono}</p>
          )}
        </div>
        <span className="ml-auto">
          <ChipModo modo={conv.modo} />
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-8">
        <ol className="mx-auto flex max-w-3xl flex-col gap-1.5">
          {mensajes.map((m, i) => {
            const nuevoDia =
              i === 0 || dia(mensajes[i - 1].createdAt) !== dia(m.createdAt);
            return (
              <li key={m.id} className="contents">
                {nuevoDia && (
                  <p className="my-3 self-center rounded-full bg-white px-3 py-1 text-xs text-gris first-letter:uppercase">
                    {dia(m.createdAt)}
                  </p>
                )}
                <Burbuja m={m} />
              </li>
            );
          })}
        </ol>
        <div ref={fondo} />
      </div>

      {cerrada ? (
        <p className="shrink-0 border-t border-linea bg-mango-suave px-5 py-3 text-sm">
          Pasaron más de 24 h desde el último mensaje del cliente. Podrás
          escribirle con plantillas (próximamente).
        </p>
      ) : (
        <form
          onSubmit={enviar}
          className="shrink-0 border-t border-linea bg-white px-3 py-3 md:px-5"
        >
          {error && <p className="mb-2 text-sm text-peligro">{error}</p>}
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={alPresionar}
              rows={1}
              maxLength={4096}
              placeholder={`Responder a ${conv.contacto.nombre.split(" ")[0]}`}
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
            Enter envía. Shift + Enter hace un salto de línea.
          </p>
        </form>
      )}
    </>
  );
}

const ESTILO: Record<Mensaje["origen"], { caja: string; etiqueta?: string }> = {
  cliente: { caja: "self-start rounded-bl-md bg-white" },
  humano: { caja: "self-end rounded-br-md bg-uva text-white" },
  ia: { caja: "self-end rounded-br-md bg-menta-suave", etiqueta: "IA" },
  app_celular: {
    caja: "self-end rounded-br-md bg-tinta-2 text-white",
    etiqueta: "Desde el celular",
  },
};

function Burbuja({ m }: { m: Mensaje }) {
  const e = ESTILO[m.origen];
  return (
    <div
      className={`entra max-w-[85%] rounded-2xl px-3.5 py-2 shadow-[0_1px_0_rgba(29,38,69,0.06)] md:max-w-[70%] ${e.caja}`}
    >
      {e.etiqueta && (
        <p className="mb-0.5 text-[11px] font-semibold opacity-70">
          {e.etiqueta}
        </p>
      )}
      <p
        className={`whitespace-pre-wrap break-words ${m.texto === null ? "italic opacity-70" : ""}`}
      >
        {textoDeMensaje(m)}
      </p>
      <p className="mt-0.5 text-right text-[11px] opacity-60">
        {hora(m.createdAt)}
      </p>
    </div>
  );
}

function ChipModo({
  modo,
  chico = false,
}: {
  modo: ConversacionResumen["modo"];
  chico?: boolean;
}) {
  const ia = modo === "ia";
  const Icono = ia ? IconoChispa : IconoPersona;
  return (
    <span
      title={
        ia
          ? "La IA atiende esta conversación"
          : "Una persona atiende esta conversación"
      }
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-medium ${chico ? "p-0.5" : "px-2.5 py-1 text-xs"} ${
        ia ? "bg-menta-suave text-menta" : "bg-uva-suave text-uva"
      }`}
    >
      <Icono className={chico ? "size-3.5" : "size-4"} />
      {!chico && (ia ? "IA" : "Persona")}
    </span>
  );
}

function Esqueleto() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex animate-pulse items-center gap-3 px-4 py-3">
          <span className="size-11 rounded-[38%] bg-papel" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-1/2 rounded bg-papel" />
            <span className="block h-3 w-3/4 rounded bg-papel" />
          </span>
        </li>
      ))}
    </>
  );
}

function Vacia({ gerente }: { gerente: boolean }) {
  return (
    <li className="px-6 py-12 text-center">
      <IconoCelular className="mx-auto mb-3 size-10 text-mango" />
      <p className="font-display text-lg font-semibold">
        Todavía no hay conversaciones
      </p>
      <p className="mt-1 text-sm text-gris">
        Cuando un cliente escriba a tu WhatsApp de ventas, aparecerá aquí al
        instante.
      </p>
      {gerente && (
        <Link
          href="/canales"
          className="mt-4 inline-block rounded-xl bg-tinta px-4 py-2.5 text-sm font-semibold text-white"
        >
          Conectar WhatsApp
        </Link>
      )}
    </li>
  );
}
