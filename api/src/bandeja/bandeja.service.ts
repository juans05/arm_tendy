import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EnvioWhatsappService } from '../canales/envio-whatsapp.service';
import { Miembro } from '../miembros/miembro.entity';
import { Conversacion, ModoConversacion } from './conversacion.entity';
import { EventosService } from './eventos.service';
import { Mensaje } from './mensaje.entity';

export interface ConversacionResumen {
  id: string;
  contacto: { id: string; nombre: string; telefono: string };
  modo: ModoConversacion;
  noLeidos: number;
  ultimoMensajeEn: Date;
  ultimoEntranteEn: Date | null;
  ultimoTexto: string | null;
}

const VENTANA_MS = 24 * 3600_000;

@Injectable()
export class BandejaService {
  constructor(
    private readonly db: DataSource,
    private readonly eventos: EventosService,
    private readonly envio: EnvioWhatsappService,
  ) {}

  // ponytail: las 200 conversaciones más recientes; paginar cuando una empresa tenga más.
  listar(tenant: string): Promise<ConversacionResumen[]> {
    return this.db.query(
      `SELECT c.id, c.modo, c.no_leidos AS "noLeidos", c.ultimo_mensaje_en AS "ultimoMensajeEn", c.ultimo_entrante_en AS "ultimoEntranteEn",
              json_build_object('id', ct.id, 'nombre', ct.nombre, 'telefono', ct.telefono) AS contacto,
              (SELECT COALESCE(m.texto, '[' || m.tipo || ']') FROM mensajes m
                WHERE m.conversacion_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS "ultimoTexto"
         FROM conversaciones c JOIN contactos ct ON ct.id = c.contacto_id
        WHERE c.tenant = $1
        ORDER BY c.ultimo_mensaje_en DESC
        LIMIT 200`,
      [tenant],
    );
  }

  // ponytail: los últimos 300 mensajes; cargar más hacia atrás cuando haga falta.
  async mensajes(tenant: string, conversacionId: string): Promise<Mensaje[]> {
    await this.conversacion(tenant, conversacionId);
    await this.db
      .getRepository(Conversacion)
      .update({ id: conversacionId, tenant }, { noLeidos: 0 });
    const ms = await this.db.getRepository(Mensaje).find({
      where: { conversacionId, tenant },
      order: { createdAt: 'DESC' },
      take: 300,
    });
    return ms.reverse();
  }

  async responder(
    tenant: string,
    conversacionId: string,
    miembro: Miembro,
    texto: string,
  ): Promise<Mensaje> {
    const conv = await this.conversacion(tenant, conversacionId);
    // Regla de WhatsApp: texto libre solo dentro de las 24 h desde el último mensaje del cliente.
    if (
      !conv.ultimoEntranteEn ||
      Date.now() - conv.ultimoEntranteEn.getTime() > VENTANA_MS
    ) {
      throw new ConflictException({
        code: 'FUERA_DE_VENTANA',
        message:
          'Pasaron más de 24 h desde el último mensaje del cliente; WhatsApp solo permite escribirle con una plantilla',
      });
    }
    // Si Meta falla, lanza 502 aquí y no se guarda nada.
    const wamid = await this.envio.enviarTexto(
      conv.numero!,
      conv.contacto!.telefono,
      texto,
    );

    const mensaje = await this.db.transaction(async (em) => {
      const m = await em.save(
        em.create(Mensaje, {
          tenant,
          conversacionId,
          direccion: 'saliente',
          origen: 'humano',
          tipo: 'text',
          texto,
          waMessageId: wamid,
          autorMiembroId: miembro.id,
        }),
      );
      await em.update(
        Conversacion,
        { id: conversacionId },
        { modo: 'humano', ultimoMensajeEn: m.createdAt },
      );
      return m;
    });
    this.eventos.emitir(tenant, { tipo: 'mensaje', conversacionId, mensaje });
    return mensaje;
  }

  private async conversacion(
    tenant: string,
    id: string,
  ): Promise<Conversacion> {
    const c = await this.db.getRepository(Conversacion).findOne({
      where: { id, tenant },
      relations: { numero: true, contacto: true },
    });
    if (!c) throw new NotFoundException('Conversación no encontrada');
    return c;
  }
}
