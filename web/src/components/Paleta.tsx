'use client';
import { useRouter } from 'next/navigation';
import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Lead } from '@/lib/bandeja';
import Avatar from './Avatar';
import { IconoBuscar } from './Iconos';
import { ChipEtapa } from './ui';

type Item = { href: string; titulo: string; detalle?: string; lead?: Lead & { contacto?: { nombre: string; telefono: string } } };

// Ctrl+K: busca un lead por nombre, teléfono o RUC, o salta a una pantalla.
export default function Paleta({ abierta, onCerrar, pantallas }: { abierta: boolean; onCerrar: () => void; pantallas: { href: string; texto: string }[] }) {
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState('');
  const [leads, setLeads] = useState<Item[]>([]);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    if (abierta) {
      setQ('');
      setSel(0);
      dialogo.current?.showModal();
    } else dialogo.current?.close();
  }, [abierta]);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) return setLeads([]);
    const id = setTimeout(async () => {
      const r = await api<{ items: NonNullable<Item['lead']>[] }>(`/leads/tabla?porPagina=6&q=${encodeURIComponent(t)}`);
      setLeads((r.data?.items ?? []).map((l) => ({ href: `/leads/${l.id}`, titulo: l.contacto?.nombre ?? 'Cliente', detalle: l.contacto?.telefono, lead: l })));
      setSel(0);
    }, 180);
    return () => clearTimeout(id);
  }, [q]);

  const t = q.trim().toLowerCase();
  const items: Item[] = [...leads, ...pantallas.filter((p) => !t || p.texto.toLowerCase().includes(t)).map((p) => ({ href: p.href, titulo: `Ir a ${p.texto}` }))];

  const ir = (it?: Item) => {
    if (!it) return;
    onCerrar();
    router.push(it.href);
  };
  const teclas = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') setSel((s) => Math.min(s + 1, items.length - 1));
    else if (e.key === 'ArrowUp') setSel((s) => Math.max(s - 1, 0));
    else if (e.key === 'Enter') ir(items[sel]);
    else return;
    e.preventDefault();
  };

  return (
    <dialog
      ref={dialogo}
      onClose={onCerrar}
      onClick={(e) => e.target === dialogo.current && onCerrar()}
      className="mx-auto mt-[12vh] w-[min(36rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-hoja p-0 text-tinta shadow-flota"
    >
      <div className="flex items-center gap-3 border-b border-linea px-4">
        <IconoBuscar className="size-5 text-gris" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={teclas}
          placeholder="Busca un cliente, teléfono o RUC"
          aria-label="Buscar"
          className="h-14 flex-1 bg-transparent text-[17px] outline-none placeholder:text-gris-2 focus-visible:outline-none"
        />
        <kbd className="rounded-md border border-linea px-1.5 py-0.5 text-xs text-gris">Esc</kbd>
      </div>
      <ul className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
        {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-gris">Nada con “{q}”. Prueba con el teléfono o el RUC.</li>}
        {items.map((it, i) => (
          <li key={it.href} role="option" aria-selected={i === sel}>
            <button
              onMouseEnter={() => setSel(i)}
              onClick={() => ir(it)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${i === sel ? 'bg-papel' : ''}`}
            >
              {it.lead ? <Avatar nombre={it.titulo} tam="size-8" /> : <span className="grid size-8 place-items-center text-gris">↵</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{it.titulo}</span>
                {it.detalle && <span className="tabular block text-xs text-gris">+{it.detalle}</span>}
              </span>
              {it.lead && <ChipEtapa etapa={it.lead.etapa} />}
            </button>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
