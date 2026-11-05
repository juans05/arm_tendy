// Tipos y lógica pura de la bandeja (probada en bandeja.test.ts).
export type Modo = 'ia' | 'humano';
export type Origen = 'cliente' | 'humano' | 'app_celular' | 'ia';

export interface Mensaje {
  id: string;
  conversacionId: string;
  direccion: 'entrante' | 'saliente';
  origen: Origen;
  tipo: string;
  texto: string | null;
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
}

export type EventoBandeja = { tipo: 'mensaje'; conversacionId: string; mensaje: Mensaje };

const TIPOS: Record<string, string> = {
  image: 'imagen', audio: 'audio', video: 'video', document: 'documento', sticker: 'sticker', location: 'ubicación', contacts: 'contacto',
};

export const textoDeMensaje = (m: { texto: string | null; tipo: string }) => m.texto ?? `[${TIPOS[m.tipo] ?? m.tipo}]`;

// Aplica un mensaje en tiempo real a la lista: sube la conversación y ajusta contadores.
export function aplicarEvento(lista: ConversacionResumen[], ev: EventoBandeja, abiertaId: string | null): ConversacionResumen[] {
  const m = ev.mensaje;
  const entrante = m.direccion === 'entrante';
  const previa = lista.find((c) => c.id === ev.conversacionId);
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
    ultimoTexto: textoDeMensaje(m),
    ultimoMensajeEn: m.createdAt,
    ultimoEntranteEn: entrante ? m.createdAt : base.ultimoEntranteEn,
    noLeidos: entrante && abiertaId !== ev.conversacionId ? base.noLeidos + 1 : base.noLeidos,
    modo: entrante ? base.modo : 'humano',
  };
  return [nueva, ...lista.filter((c) => c.id !== ev.conversacionId)];
}

export function fueraDeVentana(ultimoEntranteEn: string | null, ahora: Date): boolean {
  if (!ultimoEntranteEn) return true;
  return ahora.getTime() - new Date(ultimoEntranteEn).getTime() > 24 * 3600_000;
}
