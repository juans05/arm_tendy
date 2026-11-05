'use client';
import { useRouter } from 'next/navigation';
import { borrarToken } from '@/lib/sesion';

export default function Pendiente() {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-md space-y-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Tu acceso está pendiente de aprobación del gerente</h1>
      <p className="text-sm text-slate-600">Cuando el gerente te active, vuelve a entrar.</p>
      <div className="flex justify-center gap-4">
        <button className="rounded border px-4 py-2" onClick={() => router.replace('/')}>Reintentar</button>
        <button className="rounded bg-slate-900 px-4 py-2 text-white" onClick={() => { borrarToken(); router.replace('/login'); }}>Salir</button>
      </div>
    </main>
  );
}
