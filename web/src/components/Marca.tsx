// Logotipo: "arm" en minúsculas con el punto mango.
export default function Marca({ className = '', grande = false }: { className?: string; grande?: boolean }) {
  return (
    <span className={`flex items-baseline font-display font-extrabold tracking-tight ${grande ? 'text-5xl' : 'text-2xl'} ${className}`}>
      arm
      <span className={`ml-1 inline-block rounded-full bg-mango ${grande ? 'size-3.5' : 'size-2'}`} />
    </span>
  );
}
