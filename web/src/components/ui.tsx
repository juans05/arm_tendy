'use client';
import Link from 'next/link';
import { ButtonHTMLAttributes, ComponentProps, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Etapa, ETAPAS } from '@/lib/bandeja';

// Piezas comunes de la interfaz. Una sola fuente de botones, campos y etiquetas para toda la app.

type Variante = 'primario' | 'acento' | 'secundario' | 'fantasma' | 'peligro';
const VARIANTES: Record<Variante, string> = {
  // Tinta: la acción normal. Mango: la única acción que más importa en la pantalla.
  primario: 'bg-tinta text-white hover:bg-tinta-2 shadow-hoja',
  acento: 'bg-mango text-tinta hover:brightness-95 shadow-hoja',
  secundario: 'border border-linea-2 bg-hoja text-tinta hover:border-tinta/40',
  fantasma: 'text-gris hover:bg-tinta/5 hover:text-tinta',
  peligro: 'bg-peligro text-white hover:brightness-95',
};
const TAMANOS = { sm: 'h-8 gap-1.5 px-3 text-sm', md: 'h-10 gap-2 px-4 text-[15px]' };

export function clasesBoton(variante: Variante = 'primario', tam: 'sm' | 'md' = 'md') {
  return `inline-flex shrink-0 select-none items-center justify-center rounded-[10px] font-semibold transition active:translate-y-px disabled:pointer-events-none disabled:opacity-45 ${VARIANTES[variante]} ${TAMANOS[tam]}`;
}

export function Boton({
  variante = 'primario',
  tam = 'md',
  cargando,
  className = '',
  children,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; tam?: 'sm' | 'md'; cargando?: boolean }) {
  return (
    <button {...p} disabled={p.disabled || cargando} aria-busy={cargando || undefined} className={`${clasesBoton(variante, tam)} ${className}`}>
      {cargando && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />}
      {children}
    </button>
  );
}

export function BotonLink({ variante = 'secundario', tam = 'md', className = '', ...p }: ComponentProps<typeof Link> & { variante?: Variante; tam?: 'sm' | 'md' }) {
  return <Link {...p} className={`${clasesBoton(variante, tam)} ${className}`} />;
}

const CAMPO = 'rounded-[10px] border border-linea-2 bg-hoja px-3 text-[15px] text-tinta placeholder:text-gris-2 transition focus:border-tinta focus:outline-none focus:ring-4 focus:ring-tinta/8';

export function Campo({ etiqueta, ayuda, className = '', ...p }: InputHTMLAttributes<HTMLInputElement> & { etiqueta?: string; ayuda?: string }) {
  const input = <input {...p} className={`${CAMPO} h-10 w-full ${className}`} />;
  if (!etiqueta) return input;
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{etiqueta}</span>
      {input}
      {ayuda && <span className="block text-xs text-gris">{ayuda}</span>}
    </label>
  );
}

export function Area({ className = '', ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return <textarea {...p} className={`${CAMPO} w-full py-2.5 ${className}`} />;
}

export function Selector({ className = '', ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={`${CAMPO} h-10 cursor-pointer pr-8 ${/w-/.test(className) ? '' : 'w-full'} ${className}`} />;
}

// Filtros compactos (píldoras de 28 px): caben en una fila; el activo se pinta oscuro.
export const clasesFiltro = (activo: boolean) =>
  `h-7 cursor-pointer rounded-full border px-2.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-tinta/30 ${
    activo ? 'border-tinta bg-tinta text-white' : 'border-linea bg-hoja text-gris hover:border-linea-2 hover:text-tinta'
  }`;

export function ChipFiltro({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activo} className={`inline-flex items-center ${clasesFiltro(activo)}`}>
      {children}
    </button>
  );
}

export function SelectorFiltro({ activo, className = '', ...p }: SelectHTMLAttributes<HTMLSelectElement> & { activo: boolean }) {
  return <select {...p} className={`${clasesFiltro(activo)} ${className}`} />;
}

// Color fijo por etapa: el mismo punto aparece en la tabla, el tablero y la línea de tiempo.
export const COLOR_ETAPA: Record<Etapa, string> = {
  nuevo: '#5f6680',
  en_conversacion: '#2a7de1',
  demo_agendada: '#5b45d6',
  demo_realizada: '#8a3fc2',
  no_asistio: '#d9731a',
  seguimiento: '#b98a00',
  ganado: '#12917f',
  perdido: '#c7362e',
  archivado: '#8a90a6',
  descartado: '#8a90a6',
};

export function ChipEtapa({ etapa, className = '' }: { etapa: Etapa; className?: string }) {
  const c = COLOR_ETAPA[etapa];
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${className}`}
      style={{ background: `${c}16`, color: c }}
    >
      <span className="size-1.5 rounded-full" style={{ background: c }} />
      {ETAPAS[etapa]}
    </span>
  );
}

// Interés de 0 a 100: barra corta, más llena cuanto más caliente.
export function Puntaje({ valor }: { valor: number }) {
  const tono = valor >= 70 ? 'bg-menta' : valor >= 40 ? 'bg-mango' : 'bg-gris-2';
  return (
    <span className="inline-flex items-center gap-2" title={`Interés ${valor} de 100`}>
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-linea">
        <span className={`block h-full rounded-full ${tono}`} style={{ width: `${Math.max(4, valor)}%` }} />
      </span>
      <span className="tabular w-6 text-sm font-semibold">{valor}</span>
    </span>
  );
}

export function Vacio({ titulo, texto, accion, icono }: { titulo: string; texto?: string; accion?: ReactNode; icono?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-14 text-center">
      {icono && <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-hoja text-gris shadow-hoja">{icono}</span>}
      <p className="font-display text-lg font-bold">{titulo}</p>
      {texto && <p className="mt-1 text-sm text-gris">{texto}</p>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  );
}

export function Encabezado({ titulo, texto, children }: { titulo: string; texto?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end gap-3 px-4 pb-4 pt-6 md:px-8 md:pt-8">
      <div className="mr-auto min-w-0">
        <h1 className="font-display text-[1.9rem] font-extrabold leading-none tracking-tight">{titulo}</h1>
        {texto && <p className="mt-2 text-sm text-gris">{texto}</p>}
      </div>
      {children}
    </header>
  );
}
