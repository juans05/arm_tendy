'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Avatar from '@/components/Avatar';
import { IconoBandeja, IconoCanales, IconoEquipo, IconoLineas, IconoSalir } from '@/components/Iconos';
import Marca from '@/components/Marca';
import { me, Miembro } from '@/lib/api';
import { MiembroCtx } from '@/lib/miembro-ctx';
import { borrarToken, destinoTrasMe } from '@/lib/sesion';

// Pantallas internas: exigen miembro activo. Riel lateral en escritorio, barra inferior en el celular.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ruta = usePathname();
  const [sesion, setSesion] = useState<{ miembro: Miembro; empresa: string } | null>(null);

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
    ...(gerente ? [{ href: '/canales', texto: 'Canales', Icono: IconoCanales }] : []),
    { href: '/lineas', texto: 'Líneas', Icono: IconoLineas },
    ...(gerente ? [{ href: '/miembros', texto: 'Equipo', Icono: IconoEquipo }] : []),
  ];
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
          <Marca className="px-3" />
          <p className="mt-1 truncate px-3 text-sm text-white/55">{sesion.empresa}</p>
          <nav className="mt-8 flex flex-col gap-1">
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
            <button onClick={salir} className="ml-auto rounded-lg p-1.5 text-white/70" title="Salir">
              <IconoSalir />
              <span className="sr-only">Salir</span>
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

          {/* Celular: barra inferior */}
          <nav className="flex shrink-0 border-t border-linea bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
            {enlaces.map(({ href, texto, Icono }) => (
              <Link key={href} href={href} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${activo(href) ? 'font-semibold text-tinta' : 'text-gris'}`}>
                <span className={`rounded-full px-4 py-1 transition-colors ${activo(href) ? 'bg-mango-suave' : ''}`}>
                  <Icono className="size-5" />
                </span>
                {texto}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </MiembroCtx.Provider>
  );
}
