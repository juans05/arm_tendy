// Avatar con iniciales en tinta sobre gris: el color de la app queda reservado para lo que significa algo.
export function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter((p) => /\p{L}/u.test(p));
  if (!partes.length) return '#';
  return (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase();
}

export default function Avatar({ nombre, tam = 'size-11', oscuro = false }: { nombre: string; semilla?: string; tam?: string; oscuro?: boolean }) {
  return (
    <span
      className={`${tam} grid shrink-0 place-items-center rounded-[38%] font-display text-[0.8rem] font-bold tracking-tight ${oscuro ? 'bg-tinta text-white' : 'bg-[#e9ebf2] text-tinta-2'}`}
      aria-hidden
    >
      {iniciales(nombre)}
    </span>
  );
}
