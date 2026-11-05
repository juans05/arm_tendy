'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { me } from '@/lib/api';
import { destinoTrasMe, leerToken } from '@/lib/sesion';

// Entrada: decide a dónde ir según el token y el estado del miembro.
export default function Inicio() {
  const router = useRouter();
  useEffect(() => {
    if (!leerToken()) return router.replace('/login');
    me().then((r) => router.replace(destinoTrasMe({ status: r.status, code: r.code, rol: r.data?.miembro.rol, estado: r.data?.miembro.estado })));
  }, [router]);
  return <p className="p-8 text-slate-500">Cargando…</p>;
}
