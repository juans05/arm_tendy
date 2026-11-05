'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { me, Miembro } from '@/lib/api';
import { MiembroCtx } from '@/lib/miembro-ctx';
import { borrarToken, destinoTrasMe } from '@/lib/sesion';

// Pantallas internas: exigen miembro activo.
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

  if (!sesion) return <p className="p-8 text-slate-500">Cargando…</p>;

  const enlaces = [
    ...(sesion.miembro.rol === 'gerente' ? [{ href: '/miembros', texto: 'Miembros' }] : []),
    { href: '/lineas', texto: 'Líneas de producto' },
  ];

  return (
    <MiembroCtx.Provider value={sesion}>
      <header className="flex flex-wrap items-center gap-4 border-b bg-white px-4 py-3">
        <span className="font-semibold">ARM</span>
        <span className="text-sm text-slate-500">{sesion.empresa}</span>
        <nav className="flex gap-3 text-sm">
          {enlaces.map((e) => (
            <Link key={e.href} href={e.href} className={ruta === e.href ? 'font-semibold underline' : 'text-slate-600'}>{e.texto}</Link>
          ))}
        </nav>
        <span className="ml-auto text-sm">{sesion.miembro.nombre}</span>
        <button className="text-sm underline" onClick={() => { borrarToken(); router.replace('/login'); }}>Salir</button>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </MiembroCtx.Provider>
  );
}
