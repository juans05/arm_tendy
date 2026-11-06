import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Conversacion } from '../bandeja/conversacion.entity';
import { EventosService } from '../bandeja/eventos.service';
import { Mensaje } from '../bandeja/mensaje.entity';
import { EnvioWhatsappService } from '../canales/envio-whatsapp.service';
import { MetaGraph } from '../canales/meta-graph.client';
import { NumeroWhatsapp } from '../canales/numero-whatsapp.entity';
import { Miembro } from '../miembros/miembro.entity';

export type Plantilla = {
  nombre: string;
  idioma: string;
  categoria: string;
  texto: string;
  variables: number;
};

type PlantillaMeta = {
  name: string;
  language: string;
  status: string;
  category: string;
  components?: { type: string; text?: string }[];
};

const variables = (texto: string) =>
  new Set(texto.match(/\{\{\d+\}\}/g) ?? []).size;

// Plantillas aprobadas por Meta: la única forma de escribirle a un cliente pasadas 24 h de su último mensaje.
@Injectable()
export class PlantillasService {
  constructor(
    private readonly db: DataSource,
    private readonly meta: MetaGraph,
    private readonly envio: EnvioWhatsappService,
    private readonly eventos: EventosService,
  ) {}

  // ponytail: se consulta a Meta cada vez; cachear unos minutos si la lista se abre mucho.
  async listar(tenant: string): Promise<Plantilla[]> {
    const numero = await this.db
      .getRepository(NumeroWhatsapp)
      .findOneBy({ tenant, activo: true });
    if (!numero) return [];
    const r = await this.meta.llamar<{ data?: PlantillaMeta[] }>(
      'GET',
      `/${numero.wabaId}/message_templates`,
      {
        token: numero.token,
        query: {
          status: 'APPROVED',
          fields: 'name,language,status,category,components',
          limit: '100',
        },
      },
    );
    return (r.data ?? [])
      .filter((p) => p.status === 'APPROVED')
      .map((p) => {
        const texto = p.components?.find((c) => c.type === 'BODY')?.text ?? '';
        return {
          nombre: p.name,
          idioma: p.language,
          categoria: p.category,
          texto,
          variables: variables(texto),
        };
      });
  }

  async enviar(
    m: Miembro,
    conversacionId: string,
    nombre: string,
    idioma: string,
    parametros: string[],
  ): Promise<Mensaje> {
    const conv = await this.db.getRepository(Conversacion).findOne({
      where: { id: conversacionId, tenant: m.tenant },
      relations: { numero: true, contacto: true },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    if (m.rol !== 'gerente') {
      const [l] = await this.db.query(
        'SELECT dueno_id FROM leads WHERE conversacion_id = $1',
        [conv.id],
      );
      if (l?.dueno_id && l.dueno_id !== m.id)
        throw new NotFoundException('Conversación no encontrada');
    }
    if (conv.contacto!.noContactar)
      throw new ConflictException('El cliente pidió no ser contactado');

    const plantilla = (await this.listar(m.tenant)).find(
      (p) => p.nombre === nombre && p.idioma === idioma,
    );
    if (!plantilla) throw new BadRequestException('Plantilla no encontrada');
    if (parametros.length !== plantilla.variables)
      throw new BadRequestException(
        `La plantilla pide ${plantilla.variables} variables`,
      );

    const wamid = await this.envio.enviarPlantilla(
      conv.numero!,
      conv.contacto!.telefono,
      nombre,
      idioma,
      parametros,
    );
    const texto = plantilla.texto.replace(
      /\{\{(\d+)\}\}/g,
      (_, i: string) => parametros[Number(i) - 1] ?? '',
    );
    const mensaje = await this.db.transaction(async (em) => {
      const msg = await em.save(
        em.create(Mensaje, {
          tenant: m.tenant,
          conversacionId: conv.id,
          direccion: 'saliente',
          origen: 'humano',
          tipo: 'template',
          texto,
          waMessageId: wamid,
          autorMiembroId: m.id,
        }),
      );
      await em.update(
        Conversacion,
        { id: conv.id },
        {
          modo: 'humano',
          ultimoMensajeEn: msg.createdAt,
          borrador: null,
          alertaNivel: 0,
        },
      );
      await em.query(
        'UPDATE leads SET dueno_id = $1 WHERE conversacion_id = $2 AND dueno_id IS NULL',
        [m.id, conv.id],
      );
      return msg;
    });
    this.eventos.emitir(m.tenant, {
      tipo: 'mensaje',
      conversacionId: conv.id,
      mensaje,
    });
    return mensaje;
  }
}
