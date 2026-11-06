'use client';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Boton } from './ui';

// Avisos breves ("Tarea creada") y confirmaciones antes de algo que no se deshace.

type Tipo = 'ok' | 'error';
type Aviso = { id: number; texto: string; tipo: Tipo; deshacer?: () => void };
type Confirmacion = { titulo: string; texto?: string; accion: string; peligro?: boolean; resolver: (si: boolean) => void };

const Ctx = createContext<{
  avisar: (texto: string, o?: { tipo?: Tipo; deshacer?: () => void }) => void;
  confirmar: (c: Omit<Confirmacion, 'resolver'>) => Promise<boolean>;
} | null>(null);

export const useAvisos = () => useContext(Ctx)!;

export function Avisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [conf, setConf] = useState<Confirmacion | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const n = useRef(0);

  const avisar = useCallback((texto: string, o: { tipo?: Tipo; deshacer?: () => void } = {}) => {
    const id = ++n.current;
    setAvisos((a) => [...a.slice(-2), { id, texto, tipo: o.tipo ?? 'ok', deshacer: o.deshacer }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), o.deshacer ? 6000 : 3500);
  }, []);

  const confirmar = useCallback(
    (c: Omit<Confirmacion, 'resolver'>) => new Promise<boolean>((resolver) => setConf({ ...c, resolver })),
    [],
  );

  useEffect(() => {
    if (conf) dialogo.current?.showModal();
  }, [conf]);

  const cerrar = (si: boolean) => {
    conf?.resolver(si);
    dialogo.current?.close();
    setConf(null);
  };

  return (
    <Ctx.Provider value={{ avisar, confirmar }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
        {avisos.map((a) => (
          <div key={a.id} role="status" className="aviso pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-tinta py-2.5 pl-4 pr-2 text-[15px] text-white shadow-flota">
            <span className={`size-2 shrink-0 rounded-full ${a.tipo === 'ok' ? 'bg-menta' : 'bg-peligro'}`} aria-hidden />
            <span className="py-0.5">{a.texto}</span>
            {a.deshacer && (
              <button
                onClick={() => {
                  a.deshacer!();
                  setAvisos((x) => x.filter((y) => y.id !== a.id));
                }}
                className="rounded-lg px-2.5 py-1 text-sm font-semibold text-mango hover:bg-white/10"
              >
                Deshacer
              </button>
            )}
          </div>
        ))}
      </div>
      <dialog
        ref={dialogo}
        onCancel={(e) => {
          e.preventDefault();
          cerrar(false);
        }}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl bg-hoja p-0 text-tinta shadow-flota"
      >
        {conf && (
          <div className="p-6">
            <h2 className="font-display text-xl font-bold">{conf.titulo}</h2>
            {conf.texto && <p className="mt-2 text-[15px] text-gris">{conf.texto}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Boton variante="fantasma" onClick={() => cerrar(false)}>
                Cancelar
              </Boton>
              <Boton variante={conf.peligro ? 'peligro' : 'primario'} onClick={() => cerrar(true)} autoFocus>
                {conf.accion}
              </Boton>
            </div>
          </div>
        )}
      </dialog>
    </Ctx.Provider>
  );
}
