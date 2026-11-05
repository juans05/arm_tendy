// Tipos y lógica pura de la bandeja (probada en bandeja.test.ts).
export type Modo = 'ia' | 'humano';
export type Origen = 'cliente' | 'humano' | 'app_celular' | 'ia' | 'sistema';

export interface Mensaje {
  id: string;
  conversacionId: string;
  direccion: 'entrante' | 'saliente';
  origen: Origen;
  tipo: string;
  texto: string | null;
  mediaId?: string | null;
  mimeType?: string | null;
  createdAt: string;
}

export interface ConversacionResumen {
  id: string;
  contacto: { id: string; nombre: string; telefono: string };
  modo: Modo;
  noLeidos: number;
  ultimoMensajeEn: string;
  ultimoEntranteEn: string | null;
  ultimoTexto: string | null;
  ultimoMensajeId?: string | null;
  borrador?: string | null;
  duenoId?: string | null;
}

export type Etapa =
  | 'nuevo'
  | 'en_conversacion'
  | 'demo_agendada'
  | 'demo_realizada'
  | 'no_asistio'
  | 'ganado'
  | 'perdido'
  | 'seguimiento'
  | 'archivado'
  | 'descartado';

export interface Lead {
  id: string;
  conversacionId: string;
  contactoId: string;
  lineaId: string | null;
  etapa: Etapa;
  etapaEn: string;
  calificado: boolean;
  puntaje: number;
  datos: Record<string, { valor: string; evidencia: string }>;
  sugerencias: string[];
  duenoId: string | null;
  motivo: string | null;
  monto: number | null;
  plan: string | null;
  referral: { sourceId?: string; headline?: string; sourceUrl?: string } | null;
  createdAt: string;
}

export interface PreguntaResumen {
  id: string;
  pregunta: string;
}

export type EventoMensaje = { tipo: 'mensaje'; conversacionId: string; mensaje: Mensaje };
export type EventoBandeja =
  | EventoMensaje
  | { tipo: 'conversacion'; conversacionId: string; modo: Modo; borrador: string | null; duenoId?: string | null }
  | { tipo: 'lead'; conversacionId: string; lead: Lead }
  | { tipo: 'pregunta'; pregunta: PreguntaResumen }
  | { tipo: 'alerta'; alerta: { id: string; titulo: string; detalle: string; enlace: string | null } };

export const ETAPAS: Record<Etapa, string> = {
  nuevo: 'Nuevo',
  en_conversacion: 'En conversación',
  demo_agendada: 'Demo agendada',
  demo_realizada: 'Demo realizada',
  no_asistio: 'No asistió',
  ganado: 'Ganado',
  perdido: 'Perdido',
  seguimiento: 'En seguimiento',
  archivado: 'Archivado',
  descartado: 'Descartado',
};

const TIPOS: Record<string, string> = {
  image: 'imagen', audio: 'audio', voice: 'nota de voz', video: 'video', document: 'documento', sticker: 'sticker', location: 'ubicación', contacts: 'contacto',
};

export const textoDeMensaje = (m: { texto: string | null; tipo: string }) => m.texto ?? `[${TIPOS[m.tipo] ?? m.tipo}]`;

// Aplica un evento en tiempo real a la lista de conversaciones.
export function aplicarEvento(lista: ConversacionResumen[], ev: EventoBandeja, abiertaId: string | null): ConversacionResumen[] {
  if (ev.tipo === 'conversacion')
    return lista.map((c) =>
      c.id === ev.conversacionId
        ? { ...c, modo: ev.modo, borrador: ev.borrador, ...(ev.duenoId !== undefined ? { duenoId: ev.duenoId } : {}) }
        : c,
    );
  if (ev.tipo !== 'mensaje') return lista;

  const m = ev.mensaje;
  const entrante = m.direccion === 'entrante';
  const previa = lista.find((c) => c.id === ev.conversacionId);
  // El mismo mensaje puede llegar dos veces (por ejemplo, al transcribir un audio): solo se actualiza el texto.
  const repetido = previa?.ultimoMensajeId === m.id;
  const base: ConversacionResumen = previa ?? {
    id: ev.conversacionId,
    // El nombre real llega al recargar la lista; mientras tanto se muestra lo que hay.
    contacto: { id: '', nombre: 'Nuevo contacto', telefono: '' },
    modo: 'ia',
    noLeidos: 0,
    ultimoMensajeEn: m.createdAt,
    ultimoEntranteEn: null,
    ultimoTexto: null,
  };
  const nueva: ConversacionResumen = {
    ...base,
    ultimoMensajeId: m.id,
    ultimoTexto: textoDeMensaje(m),
    ultimoMensajeEn: m.createdAt,
    ultimoEntranteEn: entrante ? m.createdAt : base.ultimoEntranteEn,
    noLeidos: entrante && !repetido && abiertaId !== ev.conversacionId ? base.noLeidos + 1 : base.noLeidos,
    // Solo una persona (en ARM o desde el celular) saca a la IA; los mensajes de la IA no.
    modo: m.origen === 'humano' || m.origen === 'app_celular' ? 'humano' : base.modo,
  };
  return [nueva, ...lista.filter((c) => c.id !== ev.conversacionId)];
}

export function fueraDeVentana(ultimoEntranteEn: string | null, ahora: Date): boolean {
  if (!ultimoEntranteEn) return true;
  return ahora.getTime() - new Date(ultimoEntranteEn).getTime() > 24 * 3600_000;
}
