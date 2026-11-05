// Avatar con iniciales: cada contacto conserva siempre su color, así se reconoce de un vistazo en la lista.
const COLORES = [
  ['#ffb627', '#1d2645'],
  ['#1fae9f', '#ffffff'],
  ['#6c55e8', '#ffffff'],
  ['#ff7a59', '#ffffff'],
  ['#2f80ed', '#ffffff'],
  ['#e85d9e', '#ffffff'],
  ['#8bc34a', '#1d2645'],
];

function color(semilla: string) {
  let h = 0;
  for (const c of semilla) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return COLORES[h % COLORES.length];
}

export function iniciales(nombre: string) {
  const partes = nombre.trim().split(/\s+/).filter((p) => /\p{L}/u.test(p));
  if (!partes.length) return '#';
  return (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase();
}

export default function Avatar({ nombre, semilla, tam = 'size-11' }: { nombre: string; semilla: string; tam?: string }) {
  const [fondo, texto] = color(semilla || nombre);
  return (
    <span className={`${tam} grid shrink-0 place-items-center rounded-[38%] font-display text-sm font-bold`} style={{ background: fondo, color: texto }} aria-hidden>
      {iniciales(nombre)}
    </span>
  );
}
