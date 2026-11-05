// Conexión de tiempo real con la API (SSE) que se recupera sola.
export interface FuenteEventos {
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((e: { data: string }) => void) | null;
  onerror: (() => void) | null;
  close(): void;
}

const CERRADA = 2;

type Opciones<T> = {
  /** URL con el token actual; null si ya no hay sesión. */
  url: () => string | null;
  crear?: (url: string) => FuenteEventos;
  onEvento: (ev: T) => void;
  /** Se llama tras una reconexión: pudieron perderse eventos, hay que recargar. */
  onResync: () => void;
  onSinSesion: () => void;
  reintentoMs?: number;
};

// EventSource reconecta solo ante cortes de red, pero se rinde para siempre ante un 401 o un cierre del servidor
// (token vencido, miembro desactivado). Aquí se recarga lo perdido y se vuelve a abrir con el token vigente.
export function conectarEventos<T>(o: Opciones<T>): () => void {
  const crear = o.crear ?? ((u: string) => new EventSource(u) as unknown as FuenteEventos);
  let fuente: FuenteEventos | null = null;
  let reintento: ReturnType<typeof setTimeout> | undefined;
  let detenido = false;
  let abrioAntes = false;

  const abrir = () => {
    const url = o.url();
    if (!url) return o.onSinSesion();
    const f = crear(url);
    fuente = f;
    f.onopen = () => {
      if (abrioAntes) o.onResync();
      abrioAntes = true;
    };
    f.onmessage = (e) => {
      try {
        o.onEvento(JSON.parse(e.data) as T);
      } catch {
        /* latidos u otros mensajes sin JSON */
      }
    };
    f.onerror = () => {
      if (f.readyState !== CERRADA || detenido) return;
      f.close();
      o.onResync(); // si el token venció, esta recarga lo detecta (401) y lo borra
      abrioAntes = false;
      reintento = setTimeout(() => !detenido && abrir(), o.reintentoMs ?? 3000);
    };
  };

  abrir();
  return () => {
    detenido = true;
    clearTimeout(reintento);
    fuente?.close();
  };
}
