import { Injectable, Logger } from '@nestjs/common';
import { DataSource, In, IsNull, MoreThan } from 'typeorm';
import { Conversacion } from '../bandeja/conversacion.entity';
import { EventosService } from '../bandeja/eventos.service';
import { Mensaje } from '../bandeja/mensaje.entity';
import { EnvioWhatsappService } from '../canales/envio-whatsapp.service';
import { MediaWhatsappService } from '../canales/media-whatsapp.service';
import { ConocimientoService } from '../conocimiento/conocimiento.service';
import { IaService } from '../ia/ia.service';
import { trazar } from '../ia/traza';
import { Etapa, Lead } from '../leads/lead.entity';
import { anotarEtapa } from '../leads/leads.service';
import { LineaProducto } from '../lineas/linea-producto.entity';
import { configPorDefecto, EmpresaConfig } from './empresa-config.entity';
import { construirMensajes, Decision, leerDecision } from './prompt';

const HISTORIAL = 30;
// Etapas en las que la IA todavía trabaja el lead; desde demo agendada en adelante manda el comercial.
const ETAPAS_DE_LA_IA: Etapa[] = ['nuevo', 'en_conversacion', 'seguimiento'];

export interface Ganchos {
  /** Bloque 4: al pasar a humano se asigna un comercial. */
  alPasarAHumano?: (conv: Conversacion, motivo: string) => Promise<void>;
  /** Bloque 5: horarios libres para ofrecer y reserva del elegido. */
  horarios?: (conv: Conversacion, lead: Lead) => Promise<string[] | undefined>;
  alElegirHorario?: (
    conv: Conversacion,
    lead: Lead,
    horario: string,
  ) => Promise<{ respuesta: string; agendada: boolean } | null>;
  /** Bloque 6: el cliente pidió no ser contactado. */
  alPedirBaja?: (conv: Conversacion) => Promise<void>;
}

// El agente atiende una conversación en modo IA: lee el contexto, decide con la IA y aplica la decisión.
@Injectable()
export class AgenteService {
  private readonly log = new Logger(AgenteService.name);
  readonly ganchos: Ganchos = {};

  constructor(
    private readonly db: DataSource,
    private readonly ia: IaService,
    private readonly conocimiento: ConocimientoService,
    private readonly envio: EnvioWhatsappService,
    private readonly media: MediaWhatsappService,
    private readonly eventos: EventosService,
  ) {}

  async atender(conversacionId: string): Promise<void> {
    // Si mientras respondía llegó otro mensaje del cliente, se vuelve a atender (máximo 3 vueltas).
    for (let i = 0; i < 3; i++)
      if (!(await this.unaVez(conversacionId))) return;
  }

  /** true si llegó un mensaje nuevo del cliente mientras se respondía. */
  private async unaVez(id: string): Promise<boolean> {
    const conv = await this.conversacion(id);
    if (!conv || conv.modo !== 'ia' || !conv.numero?.activo) return false;
    const tenant = conv.tenant;

    await this.transcribirAudios(conv);
    const historial = (
      await this.db.getRepository(Mensaje).find({
        where: { conversacionId: id },
        order: { createdAt: 'DESC' },
        take: HISTORIAL,
      })
    ).reverse();
    const ultimo = historial.at(-1);
    if (!ultimo || ultimo.direccion !== 'entrante') return false;

    const [config, lineas, lead] = await Promise.all([
      this.db.getRepository(EmpresaConfig).findOneBy({ tenant }),
      this.db.getRepository(LineaProducto).findBy({ tenant, activa: true }),
      this.db.getRepository(Lead).findOneByOrFail({ conversacionId: id }),
    ]);
    const empresa = config ?? configPorDefecto(tenant);
    const delCliente = historial
      .filter((m) => m.direccion === 'entrante' && m.texto)
      .slice(-3)
      .map((m) => m.texto)
      .join('\n');

    const r = await trazar(
      this.db,
      { tenant, conversacionId: id, tipo: 'agente' },
      async () =>
        this.ia.chat(
          construirMensajes({
            empresa,
            lineas: lineas.map((l) => ({
              nombre: l.nombre,
              criterios: l.criterios,
            })),
            lead: {
              linea: lineas.find((l) => l.id === lead.lineaId)?.nombre ?? null,
              datos: lead.datos,
              puntaje: lead.puntaje,
              etapa: lead.etapa,
            },
            conocimiento: await this.conocimiento.buscar(tenant, delCliente),
            historial: historial.map((m) => ({
              de: m.direccion === 'entrante' ? 'cliente' : 'negocio',
              texto: m.texto ?? `[${m.tipo}]`,
              en: m.createdAt,
            })),
            horarios: await this.ganchos.horarios?.(conv, lead),
          }),
          { json: true, maxTokens: 1000 },
        ),
    );
    const d = leerDecision(r.texto);

    let respuesta = d.respuesta;
    let agendada = false;
    if (d.horarioElegido && this.ganchos.alElegirHorario) {
      const r = await this.ganchos.alElegirHorario(
        conv,
        lead,
        d.horarioElegido,
      );
      if (r) ({ respuesta, agendada } = r);
    }
    // Si se agendó, el lead ya está en demo_agendada: se relee para no pisar la etapa.
    const actual = agendada
      ? await this.db.getRepository(Lead).findOneByOrFail({ id: lead.id })
      : lead;
    await this.aplicar(conv, actual, lineas, d);
    if (d.baja) await this.ganchos.alPedirBaja?.(conv);
    if (respuesta) await this.responder(conv, empresa, respuesta);
    // Con la demo agendada el lead pasa al comercial.
    if (d.traspaso || agendada)
      await this.pasarAHumano(conv, d.traspaso ?? 'demo');

    return this.db.getRepository(Mensaje).exists({
      where: {
        conversacionId: id,
        direccion: 'entrante',
        createdAt: MoreThan(ultimo.createdAt),
      },
    });
  }

  private conversacion(id: string) {
    return this.db.getRepository(Conversacion).findOne({
      where: { id },
      relations: { numero: true, contacto: true },
    });
  }

  private async aplicar(
    conv: Conversacion,
    lead: Lead,
    lineas: LineaProducto[],
    d: Decision,
  ) {
    const cambios: Partial<Lead> = {
      datos: { ...lead.datos, ...d.datos },
      sugerencias: [...new Set([...lead.sugerencias, ...d.sugerencias])].slice(
        -20,
      ),
      puntaje: d.puntaje,
      calificado: lead.calificado || d.calificado,
    };
    const linea = d.linea
      ? lineas.find((l) => l.nombre.toLowerCase() === d.linea!.toLowerCase())
      : undefined;
    if (linea) cambios.lineaId = linea.id;
    const cambiaEtapa =
      ETAPAS_DE_LA_IA.includes(lead.etapa) && d.etapa !== lead.etapa;
    if (cambiaEtapa && d.etapa === 'descartado')
      cambios.motivo = d.motivoDescarte ?? 'no aplica';
    await this.db.transaction(async (em) => {
      await em.update(Lead, { id: lead.id }, cambios);
      if (cambiaEtapa) await anotarEtapa(em, lead, d.etapa, null);
    });
    this.eventos.emitir(conv.tenant, {
      tipo: 'lead',
      conversacionId: conv.id,
      lead: await this.db.getRepository(Lead).findOneByOrFail({ id: lead.id }),
    });

    if (d.preguntaSinRespuesta) {
      const pregunta = await this.conocimiento.crearPregunta(
        conv.tenant,
        conv.id,
        d.preguntaSinRespuesta,
      );
      this.eventos.emitir(conv.tenant, { tipo: 'pregunta', pregunta });
    }
  }

  private async responder(
    conv: Conversacion,
    empresa: EmpresaConfig,
    texto: string,
  ) {
    // La IA tardó segundos: si mientras tanto respondió un humano, la IA se calla.
    const actual = await this.db
      .getRepository(Conversacion)
      .findOneBy({ id: conv.id });
    if (actual?.modo !== 'ia') return;

    if (empresa.agenteModo === 'propone') {
      await this.db
        .getRepository(Conversacion)
        .update(conv.id, { borrador: texto });
      this.eventos.emitir(conv.tenant, {
        tipo: 'conversacion',
        conversacionId: conv.id,
        modo: 'ia',
        borrador: texto,
      });
      return;
    }

    const wamid = await this.envio.enviarTexto(
      conv.numero!,
      conv.contacto!.telefono,
      texto,
    );
    const mensaje = await this.db.getRepository(Mensaje).save({
      tenant: conv.tenant,
      conversacionId: conv.id,
      direccion: 'saliente',
      origen: 'ia',
      tipo: 'text',
      texto,
      waMessageId: wamid,
    });
    await this.db
      .getRepository(Conversacion)
      .update(conv.id, { ultimoMensajeEn: mensaje.createdAt });
    this.eventos.emitir(conv.tenant, {
      tipo: 'mensaje',
      conversacionId: conv.id,
      mensaje,
    });
  }

  async pasarAHumano(conv: Conversacion, motivo: string): Promise<void> {
    await this.db
      .getRepository(Conversacion)
      .update(conv.id, { modo: 'humano', borrador: null });
    this.eventos.emitir(conv.tenant, {
      tipo: 'conversacion',
      conversacionId: conv.id,
      modo: 'humano',
      borrador: null,
    });
    await this.ganchos.alPasarAHumano?.(conv, motivo);
  }

  // Notas de voz del cliente: se transcriben antes de que la IA lea la conversación.
  private async transcribirAudios(conv: Conversacion) {
    const audios = await this.db.getRepository(Mensaje).find({
      where: {
        conversacionId: conv.id,
        direccion: 'entrante',
        tipo: In(['audio', 'voice']),
        texto: IsNull(),
      },
      order: { createdAt: 'DESC' },
      take: 3,
    });
    for (const a of audios) {
      if (!a.mediaId) continue;
      try {
        const { datos, mime } = await this.media.descargar(
          conv.numero!,
          a.mediaId,
        );
        const r = await trazar(
          this.db,
          {
            tenant: conv.tenant,
            conversacionId: conv.id,
            tipo: 'transcripcion',
          },
          () =>
            this.ia.chat(
              [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: 'Transcribe literalmente esta nota de voz en español. Responde solo la transcripción.',
                    },
                    {
                      type: 'input_audio',
                      input_audio: {
                        data: datos.toString('base64'),
                        format: (mime.split('/')[1]?.split(';')[0] ??
                          'ogg') as 'mp3',
                      },
                    },
                  ],
                },
              ],
              { maxTokens: 1500, modelo: process.env.AI_AUDIO_MODEL },
            ),
        );
        a.texto = r.texto.trim();
        await this.db.getRepository(Mensaje).update(a.id, { texto: a.texto });
        this.eventos.emitir(conv.tenant, {
          tipo: 'mensaje',
          conversacionId: conv.id,
          mensaje: a,
        });
      } catch (e) {
        this.log.warn(
          `No se pudo transcribir el audio ${a.id}: ${(e as Error).message}`,
        );
      }
    }
  }
}
