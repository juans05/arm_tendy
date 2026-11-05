import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  configPorDefecto,
  EmpresaConfig,
} from '../agente/empresa-config.entity';
import { AlertasService } from '../alertas/alertas.service';
import { Contacto } from '../bandeja/contacto.entity';
import { Conversacion } from '../bandeja/conversacion.entity';
import { EventosService } from '../bandeja/eventos.service';
import { Mensaje } from '../bandeja/mensaje.entity';
import { Cita } from '../calendario/cita.entity';
import { textoHorario } from '../calendario/calendario.service';
import { diaLocal } from '../calendario/huecos';
import { EnvioWhatsappService } from '../canales/envio-whatsapp.service';
import { Lead } from '../leads/lead.entity';
import { anotarEtapa } from '../leads/leads.service';

const MIN = 60_000;
const H = 60 * MIN;
const DIA = 24 * H;
const HORA_RESUMEN = 8;

type Escrito = { texto: string; plantilla: string | null; params: string[] };

/**
 * Barrido de cada minuto: seguimiento de los "todavía no", leads sin atender, recordatorios de demo y
 * resumen diario. Cada tarea deja una marca en la base para no repetirse.
 */
@Injectable()
export class SeguimientoService {
  private readonly log = new Logger(SeguimientoService.name);

  constructor(
    private readonly db: DataSource,
    private readonly envio: EnvioWhatsappService,
    private readonly alertas: AlertasService,
    private readonly eventos: EventosService,
  ) {}

  async barrer(ahora = new Date()): Promise<void> {
    for (const tarea of [
      () => this.seguimientos(ahora),
      () => this.sinAtender(ahora),
      () => this.recordatorios(ahora),
      () => this.resumenes(ahora),
    ]) {
      try {
        await tarea();
      } catch (e) {
        this.log.error(`Barrido: ${(e as Error).message}`);
      }
    }
  }

  private async config(tenant: string) {
    return (
      (await this.db.getRepository(EmpresaConfig).findOneBy({ tenant })) ??
      configPorDefecto(tenant)
    );
  }

  /** Escribe al cliente: texto si la ventana de 24 h está abierta, si no la plantilla. false si no se pudo. */
  private async escribir(
    conv: Conversacion,
    e: Escrito,
    ahora: Date,
  ): Promise<boolean> {
    const contacto = conv.contacto!;
    if (contacto.noContactar || !conv.numero?.activo) return false;
    const abierta =
      conv.ultimoEntranteEn &&
      ahora.getTime() - conv.ultimoEntranteEn.getTime() < DIA;
    if (!abierta && !e.plantilla) return false;
    const config = await this.config(conv.tenant);
    try {
      const wamid = abierta
        ? await this.envio.enviarTexto(conv.numero, contacto.telefono, e.texto)
        : await this.envio.enviarPlantilla(
            conv.numero,
            contacto.telefono,
            e.plantilla!,
            config.idiomaPlantillas,
            e.params,
          );
      const mensaje = await this.db.getRepository(Mensaje).save({
        tenant: conv.tenant,
        conversacionId: conv.id,
        direccion: 'saliente',
        origen: 'sistema',
        tipo: abierta ? 'text' : 'template',
        texto: abierta
          ? e.texto
          : `[Plantilla ${e.plantilla}] ${e.params.join(' · ')}`,
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
      return true;
    } catch (err) {
      this.log.warn(
        `No se pudo escribir a ${conv.id}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  private conversacion(id: string) {
    return this.db.getRepository(Conversacion).findOneOrFail({
      where: { id },
      relations: { contacto: true, numero: true },
    });
  }

  private async avisarDuenoOGerentes(
    lead: Pick<Lead, 'tenant' | 'duenoId'>,
    a: Parameters<AlertasService['avisar']>[2],
  ) {
    await this.alertas.avisar(
      lead.tenant,
      lead.duenoId ? [lead.duenoId] : await this.alertas.gerentes(lead.tenant),
      a,
    );
  }

  // ---- Seguimiento ----

  private async seguimientos(ahora: Date) {
    // Lead que acaba de entrar a "seguimiento": se programa el primer recordatorio.
    await this.db.query(
      `UPDATE leads l SET seguimiento_paso = 0,
              seguimiento_proximo = l.etapa_en + make_interval(days =>
                COALESCE((SELECT e.seguimiento_dias_1 FROM empresas_config e WHERE e.tenant = l.tenant), 3))
        WHERE l.etapa = 'seguimiento' AND l.seguimiento_proximo IS NULL`,
    );
    const vencidos = await this.db
      .getRepository(Lead)
      .createQueryBuilder('l')
      .where("l.etapa = 'seguimiento' AND l.seguimiento_proximo <= :ahora", {
        ahora,
      })
      .take(200)
      .getMany();

    for (const lead of vencidos) {
      const config = await this.config(lead.tenant);
      const conv = await this.conversacion(lead.conversacionId);
      if (lead.seguimientoPaso >= 2 || conv.contacto!.noContactar) {
        await this.db.transaction(async (em) => {
          await em.update(Lead, lead.id, { seguimientoProximo: null });
          await anotarEtapa(em, lead, 'archivado', null);
        });
        continue;
      }
      const nombre = conv.contacto!.nombre.split(' ')[0];
      const enviado = await this.escribir(
        conv,
        {
          texto: `Hola ${nombre}, ¿pudiste pensarlo? Si quieres retomamos cuando te acomode.`,
          plantilla: config.plantillaSeguimiento,
          params: [nombre],
        },
        ahora,
      );
      if (!enviado)
        await this.avisarDuenoOGerentes(lead, {
          tipo: 'seguimiento',
          titulo: `Toca escribirle a ${conv.contacto!.nombre}`,
          detalle:
            'Dijo que todavía no; retómalo (no hay plantilla de seguimiento configurada).',
          enlace: `/bandeja?c=${conv.id}`,
        });
      const paso = lead.seguimientoPaso + 1;
      const dias =
        paso === 1 ? config.seguimientoDias2 : 2 * config.seguimientoDias2;
      await this.db.getRepository(Lead).update(lead.id, {
        seguimientoPaso: paso,
        seguimientoProximo: new Date(lead.etapaEn.getTime() + dias * DIA),
      });
    }
  }

  /** El cliente volvió a escribir: se corta el seguimiento y el lead revive. */
  async clienteRespondio(conversacionId: string): Promise<void> {
    const lead = await this.db
      .getRepository(Lead)
      .findOneBy({ conversacionId });
    if (!lead) return;
    await this.db.transaction(async (em) => {
      await em.update(Lead, lead.id, {
        seguimientoPaso: 0,
        seguimientoProximo: null,
      });
      if (lead.etapa === 'seguimiento' || lead.etapa === 'archivado')
        await anotarEtapa(em, lead, 'en_conversacion', null);
    });
  }

  /** Gancho del agente: el cliente pidió no ser contactado. */
  async pedirBaja(conv: Conversacion): Promise<void> {
    await this.db.transaction(async (em) => {
      await em.update(Contacto, conv.contactoId, { noContactar: true });
      const lead = await em.findOneBy(Lead, { conversacionId: conv.id });
      if (!lead) return;
      await em.update(Lead, lead.id, {
        seguimientoProximo: null,
        motivo: 'pidió no ser contactado',
      });
      await anotarEtapa(em, lead, 'descartado', null);
    });
  }

  // ---- Leads sin atender ----

  private async sinAtender(ahora: Date) {
    const filas: {
      id: string;
      tenant: string;
      nivel: number;
      dueno_id: string | null;
      nombre: string;
    }[] = await this.db.query(
      `SELECT c.id, c.tenant, c.alerta_nivel AS nivel, l.dueno_id, ct.nombre
         FROM conversaciones c
         JOIN contactos ct ON ct.id = c.contacto_id
         LEFT JOIN leads l ON l.conversacion_id = c.id
         LEFT JOIN empresas_config e ON e.tenant = c.tenant
        WHERE c.modo = 'humano' AND c.alerta_nivel < 2
          AND c.ultimo_entrante_en IS NOT NULL AND c.ultimo_entrante_en >= c.ultimo_mensaje_en
          AND c.ultimo_entrante_en <= $1::timestamptz - make_interval(mins => COALESCE(e.minutos_sin_atender, 15) * (c.alerta_nivel + 1))
        LIMIT 200`,
      [ahora],
    );
    for (const f of filas) {
      // Se sube el nivel antes de avisar: si otro barrido ya lo hizo, este no repite el aviso.
      const subio = await this.db
        .getRepository(Conversacion)
        .update(
          { id: f.id, alertaNivel: f.nivel },
          { alertaNivel: f.nivel + 1 },
        );
      if (!subio.affected) continue;
      const aGerentes = f.nivel === 1 || !f.dueno_id;
      await this.alertas.avisar(
        f.tenant,
        aGerentes ? await this.alertas.gerentes(f.tenant) : [f.dueno_id!],
        {
          tipo: 'sin_atender',
          titulo: `${f.nombre} espera respuesta`,
          detalle:
            f.nivel === 1
              ? 'Sigue sin respuesta después del primer aviso.'
              : 'Escribió y nadie le ha respondido.',
          enlace: `/bandeja?c=${f.id}`,
        },
      );
    }
  }

  // ---- Recordatorios de demo ----

  private async recordatorios(ahora: Date) {
    const t = ahora.getTime();
    const citas = await this.db
      .getRepository(Cita)
      .createQueryBuilder('c')
      .where(
        "c.estado = 'agendada' AND c.inicio > :ahora AND c.inicio <= :limite",
        {
          ahora,
          limite: new Date(t + DIA),
        },
      )
      .andWhere('(c.rec_24 = false OR c.rec_2 = false OR c.aviso_30 = false)')
      .take(200)
      .getMany();

    for (const c of citas) {
      const falta = c.inicio.getTime() - t;
      const config = await this.config(c.tenant);
      const lead = c.leadId
        ? await this.db.getRepository(Lead).findOneBy({ id: c.leadId })
        : null;
      const conv = lead ? await this.conversacion(lead.conversacionId) : null;
      const cuando = textoHorario(c.inicio, config.zonaHoraria);
      const marcas: Partial<Cita> = {};

      const recordar = async () => {
        if (!conv) return;
        const nombre = conv.contacto!.nombre.split(' ')[0];
        await this.escribir(
          conv,
          {
            texto: `Hola ${nombre}, recordatorio: tu demo es el ${cuando}. ¡Te esperamos!`,
            plantilla: config.plantillaRecordatorio,
            params: [nombre, cuando],
          },
          ahora,
        );
      };

      if (!c.rec24 && falta > 2 * H) {
        marcas.rec24 = true;
        // Si se agendó con menos de 24 h de anticipación, este recordatorio sobra.
        if (c.createdAt.getTime() <= c.inicio.getTime() - DIA) await recordar();
      }
      if (!c.rec2 && falta <= 2 * H) {
        marcas.rec2 = true;
        marcas.rec24 = true;
        await recordar();
      }
      if (!c.aviso30 && falta <= 30 * MIN) {
        marcas.aviso30 = true;
        await this.alertas.avisar(c.tenant, [c.miembroId], {
          tipo: 'demo_pronto',
          titulo: `En ${Math.max(1, Math.round(falta / MIN))} min: ${c.titulo}`,
          detalle: c.link ?? '',
          enlace: conv ? `/bandeja?c=${conv.id}` : '/calendario',
        });
      }
      if (Object.keys(marcas).length)
        await this.db.getRepository(Cita).update(c.id, marcas);
    }
  }

  // ---- Resumen diario ----

  private async resumenes(ahora: Date) {
    const tenants: { tenant: string }[] = await this.db.query(
      "SELECT DISTINCT tenant FROM miembros WHERE estado = 'activo' AND rol = 'gerente'",
    );
    for (const { tenant } of tenants) {
      const config = await this.config(tenant);
      const { fecha } = diaLocal(ahora, config.zonaHoraria);
      const hora = Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: config.zonaHoraria,
          hour: '2-digit',
          hourCycle: 'h23',
        }).format(ahora),
      );
      if (hora < HORA_RESUMEN || config.resumenEnviado === fecha) continue;
      await this.db
        .getRepository(EmpresaConfig)
        .save({ ...config, resumenEnviado: fecha });

      const [r] = await this.db.query(
        `SELECT
           (SELECT count(*) FROM leads WHERE tenant = $1 AND created_at > $2::timestamptz - interval '1 day')::int AS nuevos,
           (SELECT count(*) FROM lead_historial WHERE tenant = $1 AND a = 'ganado' AND en > $2::timestamptz - interval '1 day')::int AS ganados,
           (SELECT count(*) FROM citas WHERE tenant = $1 AND estado = 'agendada' AND inicio >= $2 AND inicio < $2::timestamptz + interval '1 day')::int AS demos,
           (SELECT count(*) FROM conversaciones WHERE tenant = $1 AND modo = 'humano' AND alerta_nivel > 0)::int AS sin_atender`,
        [tenant, ahora],
      );
      await this.alertas.avisar(tenant, await this.alertas.gerentes(tenant), {
        tipo: 'resumen_diario',
        titulo: `Resumen del día: ${r.demos} demos hoy`,
        detalle: `Últimas 24 h: ${r.nuevos} leads nuevos, ${r.ganados} ventas. Hoy: ${r.demos} demos. Sin atender: ${r.sin_atender}.`,
        enlace: '/panel',
      });
    }
  }
}
