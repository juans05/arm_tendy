'use client';
import { useRouter } from 'next/navigation';
import { borrarToken } from '@/lib/sesion';

export default function Pendiente() {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-md space-y-4 p-6 text-center">
      <h1 className="font-display text-3xl font-bold">Tu acceso está pendiente de aprobación del gerente</h1>
      <p className="text-sm text-gris">Cuando el gerente te active, vuelve a entrar.</p>
      <div className="flex justify-center gap-4">
        <button className="rounded-xl border border-linea px-4 py-2" onClick={() => router.replace('/')}>Reintentar</button>
        <button className="rounded bg-tinta px-4 py-2 text-white" onClick={() => { borrarToken(); router.replace('/login'); }}>Salir</button>
      </div>
    </main>
  );
}
