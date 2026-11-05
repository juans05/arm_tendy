import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  parseMessageEchoes,
  parseMetaWebhook,
} from '../canales/meta-webhook.util';
import { NumeroWhatsapp } from '../canales/numero-whatsapp.entity';
import { EventosService } from './eventos.service';
import { Mensaje } from './mensaje.entity';

type Nuevo = Pick<
  Mensaje,
  | 'direccion'
  | 'origen'
  | 'tipo'
  | 'texto'
  | 'mediaId'
  | 'mimeType'
  | 'waMessageId'
  | 'referral'
>;

// Registra en la bandeja lo que llega por el webhook de WhatsApp.
@Injectable()
export class EntrantesService {
  private readonly log = new Logger(EntrantesService.name);

  constructor(
    private readonly db: DataSource,
    private readonly eventos: EventosService,
  ) {}

  // Cada mensaje va aparte: uno que falla no impide guardar los demás. Al final el error sube
  // para que el webhook responda 500 y Meta reintente; lo ya guardado se salta por wa_message_id.
  async procesar(payload: unknown): Promise<void> {
    const errores: Error[] = [];
    const intentar = (p: Promise<void>) =>
      p.catch((e: Error) => {
        this.log.error(`webhook: ${e.message}`, e.stack);
        errores.push(e);
      });
    for (const e of parseMetaWebhook(payload)) {
      await intentar(
        this.guardar(e.phoneNumberId, e.from, e.nombre, e.timestamp, {
          direccion: 'entrante',
          origen: 'cliente',
          tipo: e.tipo,
          texto: e.texto,
          mediaId: e.mediaId,
          mimeType: e.mimeType,
          waMessageId: e.waMessageId,
          referral: e.referral,
        }),
      );
    }
    // Lo que el negocio respondió desde la app del celular (coexistencia): desde ahí atiende un humano.
    for (const e of parseMessageEchoes(payload)) {
      await intentar(
        this.guardar(e.phoneNumberId, e.to, null, new Date(), {
          direccion: 'saliente',
          origen: 'app_celular',
          tipo: 'text',
          texto: e.body,
          mediaId: null,
          mimeType: null,
          waMessageId: e.messageId,
          referral: null,
        }),
      );
    }
    if (errores.length)
      throw new Error(`No se guardaron ${errores.length} mensajes del webhook`);
  }

  private async guardar(
    phoneNumberId: string,
    telefono: string,
    nombre: string | null,
    en: Date,
    nuevo: Nuevo,
  ) {
    const r = await this.db.transaction(async (em) => {
      const numero = await em.findOneBy(NumeroWhatsapp, {
        phoneNumberId,
        activo: true,
      });
      if (!numero) {
        this.log.warn(
          `Mensaje para un número no conectado (${phoneNumberId}); se ignora`,
        );
        return null;
      }
      const tenant = numero.tenant;
      const conversacionId = await this.conversacion(
        em,
        tenant,
        numero.id,
        telefono,
        nombre,
        en,
      );

      // ON CONFLICT DO NOTHING: si Meta reenvía el mismo mensaje no se guarda ni se notifica otra vez.
      const ins = await em
        .createQueryBuilder()
        .insert()
        .into(Mensaje)
        .values({ ...nuevo, tenant, conversacionId, createdAt: en })
        .orIgnore()
        .returning('id')
        .execute();
      const id: string | undefined = ins.raw[0]?.id;
      if (!id) return null;

      const entrante = nuevo.direccion === 'entrante';
      await em.query(
        `UPDATE conversaciones SET ultimo_mensaje_en = GREATEST(ultimo_mensaje_en, $2),
           ultimo_entrante_en = CASE WHEN $3 THEN GREATEST(COALESCE(ultimo_entrante_en, $2), $2) ELSE ultimo_entrante_en END,
           no_leidos = no_leidos + CASE WHEN $3 THEN 1 ELSE 0 END,
           modo = CASE WHEN $3 THEN modo ELSE 'humano' END
         WHERE id = $1`,
        [conversacionId, en, entrante],
      );
      return {
        tenant,
        conversacionId,
        mensaje: await em.findOneByOrFail(Mensaje, { id }),
      };
    });
    if (r)
      this.eventos.emitir(r.tenant, {
        tipo: 'mensaje',
        conversacionId: r.conversacionId,
        mensaje: r.mensaje,
      });
  }

  // Upsert de contacto y conversación (seguro ante webhooks simultáneos del mismo cliente).
  private async conversacion(
    em: EntityManager,
    tenant: string,
    numeroId: string,
    telefono: string,
    nombre: string | null,
    en: Date,
  ) {
    const [c] = await em.query(
      `INSERT INTO contactos (tenant, telefono, nombre) VALUES ($1, $2, COALESCE($3::varchar, $2))
       ON CONFLICT (tenant, telefono) DO UPDATE SET nombre = COALESCE($3::varchar, contactos.nombre)
       RETURNING id`,
      [tenant, telefono, nombre],
    );
    const [conv] = await em.query(
      `INSERT INTO conversaciones (tenant, numero_id, contacto_id, ultimo_mensaje_en) VALUES ($1, $2, $3, $4)
       ON CONFLICT (numero_id, contacto_id) DO UPDATE SET tenant = conversaciones.tenant
       RETURNING id`,
      [tenant, numeroId, c.id, en],
    );
    return conv.id as string;
  }
}
