import { BadGatewayException, Injectable } from '@nestjs/common';

export class MetaError extends BadGatewayException {
  constructor(detalle: string) {
    super(`Meta respondió con error: ${detalle}`);
  }
}

type Opciones = { token?: string; body?: unknown; query?: Record<string, string> };

// Cliente mínimo de la Graph API de Meta.
@Injectable()
export class MetaGraph {
  async llamar<T>(metodo: 'GET' | 'POST', ruta: string, opts: Opciones = {}): Promise<T> {
    const url = new URL(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION ?? 'v20.0'}${ruta}`);
    for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
    const res = await fetch(url, {
      method: metodo,
      headers: {
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(20_000),
    }).catch((e: Error) => {
      throw new MetaError(e.message);
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) throw new MetaError(data?.error?.message ?? `HTTP ${res.status}`);
    return data as T;
  }
}
