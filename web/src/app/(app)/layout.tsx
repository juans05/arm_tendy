'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Avatar from '@/components/Avatar';
import Campana from '@/components/Campana';
import {
  IconoAjustes,
  IconoBandeja,
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
} from '@/components/Iconos';
import Marca from '@/components/Marca';
import { me, Miembro } from '@/lib/api';
import { MiembroCtx } from '@/lib/miembro-ctx';
import { borrarToken, destinoTrasMe } from '@/lib/sesion';

// Pantallas internas: exigen miembro activo. Riel lateral en escritorio, barra inferior en el celular.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ruta = usePathname();
  const [sesion, setSesion] = useState<{ miembro: Miembro; empresa: string } | null>(null);
  const [mas, setMas] = useState(false);
  useEffect(() => setMas(false), [ruta]);

  useEffect(() => {
    me().then((r) => {
      if (r.data?.miembro.estado === 'activo') setSesion(r.data);
      else router.replace(destinoTrasMe({ status: r.status, code: r.code, rol: r.data?.miembro.rol, estado: r.data?.miembro.estado }));
    });
  }, [router]);

  if (!sesion) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <span className="size-3 animate-ping rounded-full bg-mango" aria-label="Cargando" />
      </div>
    );
  }

  const gerente = sesion.miembro.rol === 'gerente';
  const enlaces = [
    { href: '/bandeja', texto: 'Bandeja', Icono: IconoBandeja },
    { href: '/embudo', texto: 'Embudo', Icono: IconoEmbudo },
    { href: '/calendario', texto: 'Calendario', Icono: IconoCalendario },
    ...(gerente ? [{ href: '/panel', texto: 'Panel', Icono: IconoGrafico }] : []),
    { href: '/conocimiento', texto: 'Conocimiento', Icono: IconoLibro },
    ...(gerente ? [{ href: '/agente', texto: 'Agente', Icono: IconoChispa }] : []),
    ...(gerente ? [{ href: '/canales', texto: 'Canales', Icono: IconoCanales }] : []),
    { href: '/lineas', texto: 'Líneas', Icono: IconoLineas },
    ...(gerente ? [{ href: '/miembros', texto: 'Equipo', Icono: IconoEquipo }] : []),
    { href: '/alertas', texto: 'Alertas', Icono: IconoAjustes },
  ];
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
      <div className="flex h-dvh">
        {/* Escritorio */}
        <aside className="hidden w-60 shrink-0 flex-col bg-tinta px-3 py-5 text-white md:flex">
          <div className="flex items-center gap-2 pr-1">
            <Marca className="px-3" />
            <span className="ml-auto">
              <Campana oscura />
            </span>
          </div>
          <p className="mt-1 truncate px-3 text-sm text-white/55">{sesion.empresa}</p>
          <nav className="mt-6 flex min-h-0 flex-col gap-0.5 overflow-y-auto">
            {enlaces.map(({ href, texto, Icono }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors ${
                  activo(href) ? 'bg-white/12 font-semibold text-white' : 'text-white/70 hover:bg-white/6 hover:text-white'
                }`}
              >
                <Icono className={`size-5 ${activo(href) ? 'text-mango' : ''}`} />
                {texto}
              </Link>
            ))}
          </nav>
          <div className="mt-auto flex items-center gap-3 rounded-xl bg-white/6 p-2.5">
            <Avatar nombre={sesion.miembro.nombre} semilla={sesion.miembro.id} tam="size-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{sesion.miembro.nombre}</p>
              <p className="text-xs text-white/55">{gerente ? 'Gerente' : 'Comercial'}</p>
            </div>
            <button onClick={salir} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white" title="Salir">
              <IconoSalir />
              <span className="sr-only">Salir</span>
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Celular: cabecera compacta */}
          <header className="flex shrink-0 items-center gap-3 bg-tinta px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-white md:hidden">
            <Marca />
            <span className="truncate text-sm text-white/55">{sesion.empresa}</span>
            <span className="ml-auto">
              <Campana oscura />
            </span>
            <button onClick={salir} className="rounded-lg p-1.5 text-white/70" title="Salir">
              <IconoSalir />
              <span className="sr-only">Salir</span>
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

          {/* Celular: barra inferior */}
          <nav className="flex shrink-0 border-t border-linea bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
            {barra.map(({ href, texto, Icono }) => (
              <Link key={href} href={href} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${activo(href) ? 'font-semibold text-tinta' : 'text-gris'}`}>
                <span className={`rounded-full px-4 py-1 transition-colors ${activo(href) ? 'bg-mango-suave' : ''}`}>
                  <Icono className="size-5" />
                </span>
                {texto}
              </Link>
            ))}
            <button
              onClick={() => setMas(true)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${resto.some((e) => activo(e.href)) ? 'font-semibold text-tinta' : 'text-gris'}`}
            >
              <span className="rounded-full px-4 py-1">
                <IconoMas className="size-5" />
              </span>
              Más
            </button>
          </nav>
          {mas && (
            <div className="fixed inset-0 z-40 flex items-end bg-tinta/40 md:hidden" onClick={() => setMas(false)}>
              <nav className="w-full rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-display text-lg font-bold">Más</p>
                  <button onClick={() => setMas(false)} className="rounded-lg p-1.5 text-gris" title="Cerrar">
                    <IconoCerrar className="size-5" />
                    <span className="sr-only">Cerrar</span>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {resto.map(({ href, texto, Icono }) => (
                    <Link key={href} href={href} className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-sm ${activo(href) ? 'bg-mango-suave font-semibold' : 'bg-papel'}`}>
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
    </MiembroCtx.Provider>
  );
}
