import { Injectable } from '@nestjs/common';
import { MetaGraph, MetaError } from './meta-graph.client';
import { NumeroWhatsapp } from './numero-whatsapp.entity';

// Adaptado de huarique_backend WhatsappCloudService.sendText.
@Injectable()
export class EnvioWhatsappService {
  constructor(private readonly meta: MetaGraph) {}

  async enviarTexto(
    numero: NumeroWhatsapp,
    a: string,
    texto: string,
  ): Promise<string> {
    const r = await this.meta.llamar<{ messages?: { id: string }[] }>(
      'POST',
      `/${numero.phoneNumberId}/messages`,
      {
        token: numero.token,
        body: {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: a,
          type: 'text',
          text: { body: texto, preview_url: false },
        },
      },
    );
    const id = r.messages?.[0]?.id;
    if (!id) throw new MetaError('respuesta sin id de mensaje');
    return id;
  }
}
