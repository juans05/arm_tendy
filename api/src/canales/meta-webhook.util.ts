// Copiado de huarique_backend/src/modules/whatsapp/meta-webhook.util.ts y ampliado (media, referral, timestamp).
import * as crypto from 'crypto';

export interface Referral {
  sourceId: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  headline: string | null;
}

export interface Entrante {
  phoneNumberId: string;
  from: string;
  nombre: string;
  waMessageId: string;
  tipo: string;
  texto: string | null;
  mediaId: string | null;
  mimeType: string | null;
  referral: Referral | null;
  timestamp: Date;
}

export interface Eco {
  phoneNumberId: string;
  to: string;
  messageId: string;
  body: string;
}

/** Meta firma cada webhook con HMAC-SHA256 del cuerpo crudo usando el App Secret (X-Hub-Signature-256: "sha256=<hex>"). */
export function verifyMetaSignature(rawBody: Buffer | undefined, header: string | undefined, appSecret: string): boolean {
  if (!rawBody || !header) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const provided = header.replace(/^sha256=/, '');
  return provided.length === expected.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

const lista = (v: unknown): any[] => (Array.isArray(v) ? v : []);

/** Aplana el payload de Meta (entry → changes → value → messages). Ignora estados de entrega. */
export function parseMetaWebhook(payload: any): Entrante[] {
  const out: Entrante[] = [];
  for (const entry of lista(payload?.entry)) {
    for (const change of lista(entry?.changes)) {
      const value = change?.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      for (const msg of lista(value?.messages)) {
        if (!msg?.id || !msg?.from) continue;
        const contacto = lista(value.contacts).find((c) => c?.wa_id === msg.from) ?? value.contacts?.[0];
        const media = msg.type ? msg[msg.type] : undefined;
        const ref = msg.referral;
        const ts = Number(msg.timestamp);
        out.push({
          phoneNumberId,
          from: String(msg.from),
          nombre: contacto?.profile?.name || 'Cliente',
          waMessageId: String(msg.id),
          tipo: msg.type || 'unknown',
          texto:
            msg.text?.body ??
            msg.button?.text ??
            msg.interactive?.button_reply?.title ??
            msg.interactive?.list_reply?.title ??
            media?.caption ??
            null,
          mediaId: media?.id ?? null,
          mimeType: media?.mime_type ?? null,
          referral: ref
            ? { sourceId: ref.source_id ?? null, sourceType: ref.source_type ?? null, sourceUrl: ref.source_url ?? null, headline: ref.headline ?? null }
            : null,
          timestamp: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000) : new Date(),
        });
      }
    }
  }
  return out;
}

/** Coexistencia: lo que se envía desde la app de WhatsApp Business del celular llega como eco (smb_message_echoes). */
export function parseMessageEchoes(payload: any): Eco[] {
  const out: Eco[] = [];
  for (const entry of lista(payload?.entry)) {
    for (const change of lista(entry?.changes)) {
      const value = change?.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (change?.field !== 'smb_message_echoes' || !phoneNumberId) continue;
      for (const echo of lista(value?.message_echoes)) {
        if (!echo?.id || !echo?.to) continue;
        out.push({ phoneNumberId, to: String(echo.to), messageId: String(echo.id), body: echo.text?.body ?? `[${echo.type || 'mensaje'}]` });
      }
    }
  }
  return out;
}
