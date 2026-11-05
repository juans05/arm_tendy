import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EnvioWhatsappService } from '../canales/envio-whatsapp.service';
import { MediaWhatsappService } from '../canales/media-whatsapp.service';
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
  ultimoMensajeId: string | null;
  borrador: string | null;
  duenoId: string | null;
  etapa: string | null;
}

const VENTANA_MS = 24 * 3600_000;

@Injectable()
export class BandejaService {
  constructor(
    private readonly db: DataSource,
    private readonly eventos: EventosService,
    private readonly envio: EnvioWhatsappService,
    private readonly mediaWa: MediaWhatsappService,
  ) {}

  // ponytail: las 200 conversaciones más recientes; paginar cuando una empresa tenga más.
  // Un comercial ve sus conversaciones y las que aún no tienen dueño; el gerente, todas.
  listar(m: Miembro): Promise<ConversacionResumen[]> {
    return this.db.query(
      `SELECT c.id, c.modo, c.borrador, c.no_leidos AS "noLeidos", c.ultimo_mensaje_en AS "ultimoMensajeEn", c.ultimo_entrante_en AS "ultimoEntranteEn",
              json_build_object('id', ct.id, 'nombre', ct.nombre, 'telefono', ct.telefono) AS contacto,
              u.id AS "ultimoMensajeId", COALESCE(u.texto, '[' || u.tipo || ']') AS "ultimoTexto",
              l.dueno_id AS "duenoId", l.etapa
         FROM conversaciones c
         JOIN contactos ct ON ct.id = c.contacto_id
         LEFT JOIN leads l ON l.conversacion_id = c.id
         LEFT JOIN LATERAL (SELECT m.id, m.texto, m.tipo FROM mensajes m
                             WHERE m.conversacion_id = c.id ORDER BY m.created_at DESC LIMIT 1) u ON true
        WHERE c.tenant = $1 AND ($2 = 'gerente' OR l.dueno_id IS NULL OR l.dueno_id = $3)
        ORDER BY c.ultimo_mensaje_en DESC
        LIMIT 200`,
      [m.tenant, m.rol, m.id],
    );
  }

  // ponytail: los últimos 300 mensajes; cargar más hacia atrás cuando haga falta.
  async mensajes(m: Miembro, conversacionId: string): Promise<Mensaje[]> {
    const tenant = m.tenant;
    await this.conversacion(tenant, conversacionId, m);
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
    const conv = await this.conversacion(tenant, conversacionId, miembro);
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
        {
          modo: 'humano',
          ultimoMensajeEn: m.createdAt,
          borrador: null,
          alertaNivel: 0,
        },
      );
      // Quien responde un lead sin dueño se queda con él.
      await em.query(
        'UPDATE leads SET dueno_id = $1 WHERE conversacion_id = $2 AND dueno_id IS NULL',
        [miembro.id, conversacionId],
      );
      return m;
    });
    this.eventos.emitir(tenant, { tipo: 'mensaje', conversacionId, mensaje });
    return mensaje;
  }

  async media(
    miembro: Miembro,
    mensajeId: string,
  ): Promise<{ datos: Buffer; mime: string }> {
    const m = await this.db
      .getRepository(Mensaje)
      .findOneBy({ id: mensajeId, tenant: miembro.tenant });
    if (!m?.mediaId) throw new NotFoundException('El mensaje no tiene archivo');
    const conv = await this.conversacion(
      miembro.tenant,
      m.conversacionId,
      miembro,
    );
    return this.mediaWa.descargar(conv.numero!, m.mediaId);
  }

  private async conversacion(
    tenant: string,
    id: string,
    m: Miembro,
  ): Promise<Conversacion> {
    const c = await this.db.getRepository(Conversacion).findOne({
      where: { id, tenant },
      relations: { numero: true, contacto: true },
    });
    if (!c || !(await this.puedeVer(m, id)))
      throw new NotFoundException('Conversación no encontrada');
    return c;
  }

  async puedeVer(m: Miembro, conversacionId: string): Promise<boolean> {
    if (m.rol === 'gerente') return true;
    const [l] = await this.db.query(
      'SELECT dueno_id FROM leads WHERE conversacion_id = $1',
      [conversacionId],
    );
    return !l?.dueno_id || l.dueno_id === m.id;
  }
}
