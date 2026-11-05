import { Injectable, PayloadTooLargeException } from '@nestjs/common';
import { MetaError, MetaGraph } from './meta-graph.client';
import { NumeroWhatsapp } from './numero-whatsapp.entity';

const MAX_BYTES = 25 * 1024 * 1024;

// Archivos de WhatsApp: Meta da un id; se pide la URL temporal (vale ~5 min) y se descarga con el token del número.
@Injectable()
export class MediaWhatsappService {
  constructor(private readonly meta: MetaGraph) {}

  async descargar(
    numero: NumeroWhatsapp,
    mediaId: string,
  ): Promise<{ datos: Buffer; mime: string }> {
    const info = await this.meta.llamar<{ url?: string; mime_type?: string }>(
      'GET',
      `/${mediaId}`,
      { token: numero.token },
    );
    if (!info.url) throw new MetaError('archivo sin URL');
    const res = await fetch(info.url, {
      headers: { Authorization: `Bearer ${numero.token}` },
      signal: AbortSignal.timeout(30_000),
    }).catch((e: Error) => {
      throw new MetaError(e.message);
    });
    if (!res.ok) throw new MetaError(`descarga HTTP ${res.status}`);
    const datos = Buffer.from(await res.arrayBuffer());
    if (datos.length > MAX_BYTES)
      throw new PayloadTooLargeException('Archivo demasiado grande');
    return {
      datos,
      mime:
        info.mime_type ??
        res.headers.get('content-type') ??
        'application/octet-stream',
    };
  }

  /** Sube un archivo a Meta y devuelve su id, para enviarlo después en un mensaje. */
  async subir(
    numero: NumeroWhatsapp,
    datos: Buffer,
    mime: string,
  ): Promise<string> {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mime);
    form.append(
      'file',
      new Blob([new Uint8Array(datos)], { type: mime }),
      'archivo',
    );
    const res = await fetch(
      `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION ?? 'v20.0'}/${numero.phoneNumberId}/media`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${numero.token}` },
        body: form,
        signal: AbortSignal.timeout(30_000),
      },
    ).catch((e: Error) => {
      throw new MetaError(e.message);
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      error?: { message?: string };
    };
    if (!res.ok || !data.id)
      throw new MetaError(data.error?.message ?? `HTTP ${res.status}`);
    return data.id;
  }
}
