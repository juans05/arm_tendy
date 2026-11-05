import { Injectable, Logger } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { EmpresaConfig } from '../agente/empresa-config.entity';
import { EventosService } from '../bandeja/eventos.service';
import { EnvioWhatsappService } from '../canales/envio-whatsapp.service';
import { NumeroWhatsapp } from '../canales/numero-whatsapp.entity';
import { Miembro } from '../miembros/miembro.entity';
import { Alerta, TipoAlerta } from './alerta.entity';

export type NuevaAlerta = {
  tipo: TipoAlerta;
  titulo: string;
  detalle?: string;
  enlace?: string | null;
};

// Campanita de ARM y, si la empresa tiene plantilla de alerta aprobada, WhatsApp al celular de alertas.
@Injectable()
export class AlertasService {
  private readonly log = new Logger(AlertasService.name);

  constructor(
    private readonly db: DataSource,
    private readonly eventos: EventosService,
    private readonly envio: EnvioWhatsappService,
  ) {}

  async avisar(
    tenant: string,
    miembroIds: string[],
    a: NuevaAlerta,
  ): Promise<void> {
    if (!miembroIds.length) return;
    const miembros = (
      await this.db.getRepository(Miembro).findBy({
        tenant,
        id: In([...new Set(miembroIds)]),
        estado: 'activo',
      })
    ).filter((m) => !m.alertasOff.includes(a.tipo));
    if (!miembros.length) return;

    const guardadas = await this.db.getRepository(Alerta).save(
      miembros.map((m) => ({
        tenant,
        miembroId: m.id,
        tipo: a.tipo,
        titulo: a.titulo.slice(0, 200),
        detalle: a.detalle ?? '',
        enlace: a.enlace ?? null,
      })),
    );
    for (const alerta of guardadas)
      this.eventos.emitir(tenant, {
        tipo: 'alerta',
        miembroId: alerta.miembroId,
        alerta,
      });

    const conCelular = miembros.filter((m) => m.celularAlertas);
    if (!conCelular.length) return;
    const config = await this.db
      .getRepository(EmpresaConfig)
      .findOneBy({ tenant });
    if (!config?.plantillaAlerta) return;
    const numero = await this.db
      .getRepository(NumeroWhatsapp)
      .findOneBy({ tenant, activo: true });
    if (!numero) return;
    for (const m of conCelular) {
      try {
        await this.envio.enviarPlantilla(
          numero,
          m.celularAlertas!,
          config.plantillaAlerta,
          config.idiomaPlantillas,
          [a.titulo, a.detalle || '-'].map((p) => p.slice(0, 1000)),
        );
      } catch (e) {
        this.log.warn(
          `No se pudo avisar por WhatsApp a ${m.id}: ${(e as Error).message}`,
        );
      }
    }
  }

  async gerentes(tenant: string): Promise<string[]> {
    const ms = await this.db
      .getRepository(Miembro)
      .findBy({ tenant, rol: 'gerente', estado: 'activo' });
    return ms.map((m) => m.id);
  }

  listar(m: Miembro): Promise<Alerta[]> {
    return this.db.getRepository(Alerta).find({
      where: { tenant: m.tenant, miembroId: m.id },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async marcarLeidas(m: Miembro): Promise<void> {
    await this.db
      .getRepository(Alerta)
      .update(
        { tenant: m.tenant, miembroId: m.id, leida: false },
        { leida: true },
      );
  }
}
