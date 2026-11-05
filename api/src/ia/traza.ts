import { DataSource } from 'typeorm';
import { EjecucionIa } from './ejecucion-ia.entity';
import { RespuestaIa } from './ia.service';

/** Ejecuta una llamada a la IA y deja su traza (modelo, tokens, tiempo, salida o error) en ejecuciones_ia. */
export async function trazar(
  db: DataSource,
  base: { tenant: string; conversacionId: string | null; tipo: string },
  fn: () => Promise<RespuestaIa>,
): Promise<RespuestaIa> {
  const inicio = Date.now();
  try {
    const r = await fn();
    await db.getRepository(EjecucionIa).insert({
      ...base,
      modelo: r.modelo,
      tokensEntrada: r.tokensEntrada,
      tokensSalida: r.tokensSalida,
      ms: Date.now() - inicio,
      salida: { texto: r.texto.slice(0, 8000) },
    });
    return r;
  } catch (e) {
    await db.getRepository(EjecucionIa).insert({
      ...base,
      ms: Date.now() - inicio,
      error: (e as Error).message.slice(0, 1000),
    });
    throw e;
  }
}
