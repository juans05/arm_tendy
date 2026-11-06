import { Etapa, Lead } from './bandeja';

// Tipos de la tabla de leads, notas, tareas y vistas guardadas.
export type LeadFila = Lead & { contacto?: { nombre: string; telefono: string } };

export type Orden = 'reciente' | 'antiguo' | 'puntaje' | 'monto' | 'nombre';
export interface Filtros {
  q?: string;
  etapas?: Etapa[];
  lineaId?: string;
  duenoId?: string;
  calificado?: boolean;
  orden?: Orden;
}

export interface Vista {
  id: string;
  miembroId: string;
  nombre: string;
  filtros: Filtros;
  compartida: boolean;
}

export type EstadoTarea = 'pendiente' | 'hecha' | 'cancelada';
export interface Tarea {
  id: string;
  leadId: string;
  titulo: string;
  venceEn: string | null;
  responsableId: string;
  creadorId: string | null;
  estado: EstadoTarea;
  origen: 'manual' | 'auto';
  hechaEn: string | null;
  lead?: LeadFila;
}

export type ItemLinea =
  | { tipo: 'etapa'; id: string; en: string; de: Etapa | null; a: Etapa; miembroId: string | null }
  | { tipo: 'nota'; id: string; en: string; texto: string; autorId: string; menciones: string[] }
  | ({ tipo: 'tarea'; en: string } & Pick<Tarea, 'id' | 'titulo' | 'venceEn' | 'estado' | 'responsableId' | 'origen' | 'hechaEn'>)
  | { tipo: 'cita'; id: string; en: string; titulo: string; estado: string; miembroId: string; fin: string };

/** Filtros como parámetros de /leads/tabla (las etapas van separadas por coma). */
export function aQuery(f: Filtros, pagina = 1, porPagina = 50): string {
  const p = new URLSearchParams();
  if (f.q?.trim()) p.set('q', f.q.trim());
  if (f.etapas?.length) p.set('etapas', f.etapas.join(','));
  if (f.lineaId) p.set('lineaId', f.lineaId);
  if (f.duenoId) p.set('duenoId', f.duenoId);
  if (f.calificado !== undefined) p.set('calificado', String(f.calificado));
  if (f.orden) p.set('orden', f.orden);
  p.set('pagina', String(pagina));
  p.set('porPagina', String(porPagina));
  return p.toString();
}

/** "Vence hoy 4:00 p. m.", "Venció ayer", "Vence el 12 nov." — y si ya pasó. */
export function vencimiento(iso: string | null, ahora = new Date()): { texto: string; vencida: boolean; hoy: boolean } | null {
  if (!iso) return null;
  const d = new Date(iso);
  const vencida = d.getTime() < ahora.getTime();
  const dias = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date(ahora).setHours(0, 0, 0, 0)) / 86_400_000);
  const hora = d.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' });
  const cuando =
    dias === 0 ? `hoy ${hora}` : dias === 1 ? `mañana ${hora}` : dias === -1 ? 'ayer' : d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
  return { texto: `${vencida ? 'Venció' : 'Vence'} ${cuando}`, vencida, hoy: dias === 0 };
}

/** Partes de una nota: texto suelto y @menciones, para resaltar a quién se nombró. */
export function partesNota(texto: string): { t: string; mencion: boolean }[] {
  return texto.split(/(@[\w-]+(?:\.[\w-]+)*)/g).filter(Boolean).map((t) => ({ t, mencion: t.startsWith('@') }));
}
