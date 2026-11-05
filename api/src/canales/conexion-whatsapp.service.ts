import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt } from 'crypto';
import { Repository } from 'typeorm';
import { MetaError, MetaGraph } from './meta-graph.client';
import {
  NumeroPublico,
  NumeroWhatsapp,
  publico,
} from './numero-whatsapp.entity';

type Conectar = {
  code: string;
  wabaId: string;
  phoneNumberId?: string;
  coexistencia?: boolean;
};
type ConectarExistente = {
  phoneNumberId: string;
  wabaId: string;
  token: string;
};

// Adaptado de huarique_backend MetaConnectService.complete. Diferencia clave: el webhook se redirige
// a ARM por número (override_callback_uri) para no robarle los mensajes a Wuarikes, que usa la misma app.
@Injectable()
export class ConexionWhatsappService {
  private readonly log = new Logger(ConexionWhatsappService.name);

  constructor(
    @InjectRepository(NumeroWhatsapp)
    private readonly repo: Repository<NumeroWhatsapp>,
    private readonly meta: MetaGraph,
  ) {}

  async conectar(tenant: string, dto: Conectar): Promise<NumeroPublico> {
    if (dto.phoneNumberId) await this.asegurarLibre(tenant, dto.phoneNumberId);
    const { access_token: token } = await this.meta.llamar<{
      access_token: string;
    }>('GET', '/oauth/access_token', {
      query: {
        client_id: process.env.META_APP_ID ?? '',
        client_secret: process.env.META_APP_SECRET ?? '',
        code: dto.code,
      },
    });
    const phoneId =
      dto.phoneNumberId ?? (await this.primerNumero(dto.wabaId, token));
    if (!dto.phoneNumberId) await this.asegurarLibre(tenant, phoneId);

    await this.meta.llamar('POST', `/${dto.wabaId}/subscribed_apps`, { token });
    if (!dto.coexistencia) {
      const pin = String(randomInt(100000, 1000000));
      await this.meta
        .llamar('POST', `/${phoneId}/register`, {
          token,
          body: { messaging_product: 'whatsapp', pin },
        })
        .catch((e: Error) =>
          this.log.warn(`register ${phoneId}: ${e.message}`),
        );
    }
    return this.terminar(
      tenant,
      phoneId,
      dto.wabaId,
      token,
      !!dto.coexistencia,
    );
  }

  async conectarExistente(
    tenant: string,
    dto: ConectarExistente,
  ): Promise<NumeroPublico> {
    await this.asegurarLibre(tenant, dto.phoneNumberId);
    await this.meta.llamar('POST', `/${dto.wabaId}/subscribed_apps`, {
      token: dto.token,
    });
    return this.terminar(
      tenant,
      dto.phoneNumberId,
      dto.wabaId,
      dto.token,
      false,
    );
  }

  async listar(tenant: string): Promise<NumeroPublico[]> {
    return (
      await this.repo.find({ where: { tenant }, order: { createdAt: 'ASC' } })
    ).map(publico);
  }

  porPhoneNumberId(phoneNumberId: string): Promise<NumeroWhatsapp | null> {
    return this.repo.findOneBy({ phoneNumberId });
  }

  private async terminar(
    tenant: string,
    phoneId: string,
    wabaId: string,
    token: string,
    coexistencia: boolean,
  ) {
    await this.redirigir(phoneId, wabaId, token);
    const info = await this.meta.llamar<{
      display_phone_number?: string;
      verified_name?: string;
    }>('GET', `/${phoneId}`, {
      token,
      query: { fields: 'display_phone_number,verified_name' },
    });
    const datos = {
      tenant,
      phoneNumberId: phoneId,
      wabaId,
      token,
      coexistencia,
      activo: true,
      telefono: (info.display_phone_number ?? '').replace(/\D/g, ''),
      nombreVerificado: info.verified_name ?? null,
    };
    // Recién aquí se guarda: si Meta falló antes, no queda nada a medias.
    const existente = await this.repo.findOneBy({ phoneNumberId: phoneId });
    if (existente && existente.tenant !== tenant) throw this.ocupado();
    try {
      return publico(
        await this.repo.save(
          this.repo.merge(existente ?? this.repo.create(), datos),
        ),
      );
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw this.ocupado();
      throw e;
    }
  }

  // Webhook del número → ARM. Si Meta no acepta la redirección por número, solo se redirige la cuenta
  // completa cuando ese es su único número (así nunca se desvían mensajes de otros números).
  private async redirigir(phoneId: string, wabaId: string, token: string) {
    const webhook = {
      override_callback_uri: `${process.env.ARM_PUBLIC_URL}/webhooks/whatsapp`,
      verify_token: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    };
    try {
      await this.meta.llamar('POST', `/${phoneId}`, {
        token,
        body: { webhook_configuration: webhook },
      });
    } catch (e) {
      if (!(e instanceof MetaError)) throw e;
      this.log.warn(
        `redirección por número rechazada (${phoneId}): ${e.message}`,
      );
      const { data } = await this.meta.llamar<{ data: { id: string }[] }>(
        'GET',
        `/${wabaId}/phone_numbers`,
        { token },
      );
      if (data.length !== 1) {
        throw new ConflictException(
          'Este número comparte cuenta de WhatsApp Business con otros números; conéctalo desde una cuenta propia',
        );
      }
      await this.meta.llamar('POST', `/${wabaId}/subscribed_apps`, {
        token,
        body: webhook,
      });
    }
  }

  private async primerNumero(wabaId: string, token: string): Promise<string> {
    const { data } = await this.meta.llamar<{ data: { id: string }[] }>(
      'GET',
      `/${wabaId}/phone_numbers`,
      { token },
    );
    if (!data?.length)
      throw new MetaError('la cuenta de WhatsApp Business no tiene números');
    return data[0].id;
  }

  private async asegurarLibre(tenant: string, phoneNumberId: string) {
    const n = await this.repo.findOneBy({ phoneNumberId });
    if (n && n.tenant !== tenant) throw this.ocupado();
  }

  private ocupado() {
    return new ConflictException(
      'Este número de WhatsApp ya está conectado a otra empresa',
    );
  }
}
