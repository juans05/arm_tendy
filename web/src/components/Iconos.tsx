// Íconos de trazo, sin dependencias.
type P = { className?: string };
const base = (d: React.ReactNode) =>
  function Icono({ className = 'size-5' }: P) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
        {d}
      </svg>
    );
  };

export const IconoBandeja = base(<><path d="M4 13h4l1.5 2.5h5L16 13h4" /><path d="M5.5 5h13L21 13v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5z" /></>);
export const IconoCanales = base(<><path d="M5 19l1.4-4A7.5 7.5 0 1 1 9 18z" /><path d="M9.5 9.5c.3 1.8 1.7 3.6 3.6 4.3l1.1-1.1 1.8.8-.3 1.5c-3.4.2-7-3.3-6.8-6.8l1.5-.3.8 1.8z" /></>);
export const IconoEquipo = base(<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" /><circle cx="17" cy="9" r="2.4" /><path d="M16 14.6c2.3 0 4 1.3 4.5 3.9" /></>);
export const IconoLineas = base(<><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>);
export const IconoSalir = base(<><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /><path d="M10 16l-4-4 4-4" /><path d="M6 12h10" /></>);
export const IconoEnviar = base(<><path d="M4 12l16-8-6 16-2.5-6.5z" /><path d="M11.5 13.5L20 4" /></>);
export const IconoAtras = base(<path d="M15 5l-7 7 7 7" />);
export const IconoChispa = base(<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />);
export const IconoPersona = base(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></>);
export const IconoCelular = base(<><rect x="7" y="3" width="10" height="18" rx="2.5" /><path d="M11 18h2" /></>);
