import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI from 'openai';

type Mensajes = OpenAI.Chat.ChatCompletionMessageParam[];

export interface Proveedor {
  nombre: string;
  modelo: string;
  cliente: Pick<OpenAI, 'chat' | 'embeddings'>;
}

export interface RespuestaIa {
  texto: string;
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
}

/** Dimensión fija de la columna vector(1536) de conocimiento_fragmentos. */
export const DIMENSION_EMBEDDING = 1536;
const TIEMPO_MAX_MS = 30_000;

/**
 * Proveedores desde el entorno. Todos hablan la API compatible con OpenAI, así que el mismo código sirve para
 * OpenRouter (Claude, GPT, Gemini…), Gemini directo, OpenAI u Ollama local: solo cambia AI_BASE_URL y el modelo.
 * AI_FALLBACK_* es opcional: se usa si el principal falla.
 */
export function proveedoresDesdeEnv(env = process.env): Proveedor[] {
  const crear = (pre: string, nombre: string): Proveedor | null => {
    const baseURL = env[`${pre}BASE_URL`];
    const modelo = env[`${pre}MODEL`];
    if (!baseURL || !modelo) return null;
    return {
      nombre,
      modelo,
      cliente: new OpenAI({
        baseURL,
        apiKey: env[`${pre}API_KEY`] || 'sin-clave', // Ollama no pide clave
        timeout: TIEMPO_MAX_MS,
        maxRetries: 1,
      }),
    };
  };
  return [crear('AI_', 'principal'), crear('AI_FALLBACK_', 'respaldo')].filter(
    (p): p is Proveedor => p !== null,
  );
}

// Puerta única a los modelos de IA (chat, visión, audio y embeddings), independiente del proveedor.
@Injectable()
export class IaService {
  private readonly log = new Logger(IaService.name);

  constructor(private readonly proveedores: Proveedor[]) {}

  activa(): boolean {
    return this.proveedores.length > 0;
  }

  /** `modelo` fuerza un modelo concreto en el principal (por ejemplo, uno con audio). */
  async chat(
    mensajes: Mensajes,
    opts: { json?: boolean; maxTokens?: number; modelo?: string } = {},
  ): Promise<RespuestaIa> {
    for (const [i, p] of this.proveedores.entries()) {
      const modelo = i === 0 && opts.modelo ? opts.modelo : p.modelo;
      try {
        const r = await p.cliente.chat.completions.create({
          model: modelo,
          messages: mensajes,
          max_tokens: opts.maxTokens ?? 800,
          ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        });
        const texto = r.choices[0]?.message?.content ?? '';
        if (!texto.trim()) throw new Error('respuesta vacía');
        return {
          texto,
          modelo,
          tokensEntrada: r.usage?.prompt_tokens ?? 0,
          tokensSalida: r.usage?.completion_tokens ?? 0,
        };
      } catch (e) {
        this.log.warn(
          `IA ${p.nombre} (${modelo}) falló: ${(e as Error).message}`,
        );
      }
    }
    throw new ServiceUnavailableException(
      'La IA no está disponible en este momento',
    );
  }

  /** null si no hay modelo de embeddings: la búsqueda cae al texto completo. */
  async embeddings(textos: string[]): Promise<number[][] | null> {
    const modelo = process.env.AI_EMBED_MODEL;
    const p = this.proveedores[0];
    if (!p || !modelo || !textos.length) return null;
    try {
      const r = await p.cliente.embeddings.create({
        model: modelo,
        input: textos,
        dimensions: DIMENSION_EMBEDDING,
      });
      return r.data.map((d) => d.embedding);
    } catch (e) {
      this.log.warn(`Embeddings fallaron: ${(e as Error).message}`);
      return null;
    }
  }
}
