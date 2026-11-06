'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Avatar from '@/components/Avatar';
import { Avisos } from '@/components/Avisos';
import Campana from '@/components/Campana';
import {
  IconoAjustes,
  IconoBandeja,
  IconoBuscar,
  IconoCalendario,
  IconoCanales,
  IconoCerrar,
  IconoChispa,
  IconoEmbudo,
  IconoEquipo,
  IconoGrafico,
  IconoLibro,
  IconoLineas,
  IconoMas,
  IconoSalir,
  IconoTabla,
  IconoTareas,
} from '@/components/Iconos';
import Marca from '@/components/Marca';
import Paleta from '@/components/Paleta';
import { me, Miembro } from '@/lib/api';
import { MiembroCtx } from '@/lib/miembro-ctx';
import { borrarToken, destinoTrasMe } from '@/lib/sesion';

type Enlace = { href: string; texto: string; Icono: (p: { className?: string }) => React.ReactElement };

// Pantallas internas: exigen miembro activo. Riel lateral claro en escritorio, barra inferior en el celular.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ruta = usePathname();
  const [sesion, setSesion] = useState<{ miembro: Miembro; empresa: string } | null>(null);
  const [mas, setMas] = useState(false);
  const [paleta, setPaleta] = useState(false);
  useEffect(() => setMas(false), [ruta]);

  useEffect(() => {
    me().then((r) => {
      if (r.data?.miembro.estado === 'activo') setSesion(r.data);
      else router.replace(destinoTrasMe({ status: r.status, code: r.code, rol: r.data?.miembro.rol, estado: r.data?.miembro.estado }));
    });
  }, [router]);

  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaleta(true);
      }
    };
    window.addEventListener('keydown', atajo);
    return () => window.removeEventListener('keydown', atajo);
  }, []);

  if (!sesion) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <span className="size-3 animate-ping rounded-full bg-mango" aria-label="Cargando" />
      </div>
    );
  }

  const gerente = sesion.miembro.rol === 'gerente';
  // Tres grupos: el trabajo del día, los números y la configuración.
  const grupos: Enlace[][] = [
    [
      { href: '/bandeja', texto: 'Bandeja', Icono: IconoBandeja },
      { href: '/leads', texto: 'Leads', Icono: IconoTabla },
      { href: '/tareas', texto: 'Tareas', Icono: IconoTareas },
      { href: '/embudo', texto: 'Embudo', Icono: IconoEmbudo },
      { href: '/calendario', texto: 'Calendario', Icono: IconoCalendario },
    ],
    gerente ? [{ href: '/panel', texto: 'Panel', Icono: IconoGrafico }] : [],
    [
      { href: '/conocimiento', texto: 'Conocimiento', Icono: IconoLibro },
      ...(gerente ? [{ href: '/agente', texto: 'Agente', Icono: IconoChispa }] : []),
      ...(gerente ? [{ href: '/canales', texto: 'Canales', Icono: IconoCanales }] : []),
      { href: '/lineas', texto: 'Líneas', Icono: IconoLineas },
      ...(gerente ? [{ href: '/miembros', texto: 'Equipo', Icono: IconoEquipo }] : []),
      { href: '/alertas', texto: 'Alertas', Icono: IconoAjustes },
    ],
  ].filter((g) => g.length);
  const enlaces = grupos.flat();
  // En el celular caben 4 en la barra; el resto va en "Más".
  const barra = enlaces.slice(0, 4);
  const resto = enlaces.slice(4);
  const salir = () => {
    borrarToken();
    router.replace('/login');
  };
  const activo = (href: string) => ruta === href || ruta.startsWith(href + '/');

  return (
    <MiembroCtx.Provider value={sesion}>
      <Avisos>
        <div className="flex h-dvh">
          {/* Escritorio */}
          <aside className="hidden w-60 shrink-0 flex-col border-r border-linea bg-hoja px-3 pb-3 pt-5 md:flex">
            <div className="flex items-center gap-2 px-3">
              <Marca />
              <span className="ml-auto">
                <Campana />
              </span>
            </div>
            <p className="mt-0.5 truncate px-3 text-sm text-gris">{sesion.empresa}</p>

            <button
              onClick={() => setPaleta(true)}
              className="mx-1 mt-5 flex h-9 items-center gap-2 rounded-[10px] border border-linea bg-papel px-2.5 text-sm text-gris transition hover:border-linea-2"
            >
              <IconoBuscar className="size-4" />
              Buscar
              <kbd className="ml-auto rounded border border-linea-2 bg-hoja px-1.5 text-[11px]">Ctrl K</kbd>
            </button>

            <nav className="mt-4 flex min-h-0 flex-col overflow-y-auto">
              {grupos.map((g, i) => (
                <div key={i} className={i ? 'mt-2 border-t border-linea pt-2' : ''}>
                  {g.map(({ href, texto, Icono }) => (
                    <Link
                      key={href}
                      href={href}
                      aria-current={activo(href) ? 'page' : undefined}
                      className={`group flex items-center gap-3 rounded-[10px] px-3 py-2 text-[15px] transition-colors ${
                        activo(href) ? 'font-bold text-tinta' : 'text-gris hover:bg-papel hover:text-tinta'
                      }`}
                    >
                      <Icono className={`size-[1.15rem] ${activo(href) ? 'text-tinta' : 'text-gris-2 group-hover:text-tinta'}`} />
                      <span className={activo(href) ? 'marcador' : ''}>{texto}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </nav>

            <div className="mt-auto flex items-center gap-3 rounded-xl p-2 hover:bg-papel">
              <Avatar nombre={sesion.miembro.nombre} tam="size-9" oscuro />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{sesion.miembro.nombre}</p>
                <p className="text-xs text-gris">{gerente ? 'Gerente' : 'Comercial'}</p>
              </div>
              <button onClick={salir} className="rounded-lg p-1.5 text-gris hover:bg-tinta/5 hover:text-tinta" title="Salir">
                <IconoSalir />
                <span className="sr-only">Salir</span>
              </button>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            {/* Celular: cabecera compacta */}
            <header className="flex shrink-0 items-center gap-2 border-b border-linea bg-hoja px-4 pb-2.5 pt-[calc(0.6rem+env(safe-area-inset-top))] md:hidden">
              <Marca />
              <span className="truncate text-sm text-gris">{sesion.empresa}</span>
              <button onClick={() => setPaleta(true)} className="ml-auto rounded-lg p-1.5 text-gris" title="Buscar">
                <IconoBuscar />
                <span className="sr-only">Buscar</span>
              </button>
              <Campana />
            </header>
            <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>

            {/* Celular: barra inferior */}
            <nav className="flex shrink-0 border-t border-linea bg-hoja pb-[env(safe-area-inset-bottom)] md:hidden">
              {barra.map(({ href, texto, Icono }) => (
                <Link key={href} href={href} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${activo(href) ? 'font-bold text-tinta' : 'text-gris'}`}>
                  <span className={`rounded-full px-4 py-1 transition-colors ${activo(href) ? 'bg-mango' : ''}`}>
                    <Icono className="size-5" />
                  </span>
                  {texto}
                </Link>
              ))}
              <button
                onClick={() => setMas(true)}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${resto.some((e) => activo(e.href)) ? 'font-bold text-tinta' : 'text-gris'}`}
              >
                <span className={`rounded-full px-4 py-1 ${resto.some((e) => activo(e.href)) ? 'bg-mango' : ''}`}>
                  <IconoMas className="size-5" />
                </span>
                Más
              </button>
            </nav>
            {mas && (
              <div className="fixed inset-0 z-40 flex items-end bg-tinta/40 md:hidden" onClick={() => setMas(false)}>
                <nav className="w-full rounded-t-3xl bg-hoja p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
                  <div className="mb-3 flex items-center gap-3">
                    <Avatar nombre={sesion.miembro.nombre} tam="size-9" oscuro />
                    <p className="min-w-0 flex-1 truncate font-semibold">{sesion.miembro.nombre}</p>
                    <button onClick={salir} className="rounded-lg px-2 py-1.5 text-sm text-gris">
                      Salir
                    </button>
                    <button onClick={() => setMas(false)} className="rounded-lg p-1.5 text-gris" title="Cerrar">
                      <IconoCerrar className="size-5" />
                      <span className="sr-only">Cerrar</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {resto.map(({ href, texto, Icono }) => (
                      <Link key={href} href={href} className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-sm ${activo(href) ? 'bg-mango font-semibold' : 'bg-papel'}`}>
                        <Icono className="size-6" />
                        {texto}
                      </Link>
                    ))}
                  </div>
                </nav>
              </div>
            )}
          </div>
        </div>
        <Paleta abierta={paleta} onCerrar={() => setPaleta(false)} pantallas={enlaces} />
      </Avisos>
    </MiembroCtx.Provider>
  );
}
