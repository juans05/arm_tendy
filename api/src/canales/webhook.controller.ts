import { SkipThrottle } from '@nestjs/throttler';
import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  InternalServerErrorException,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../auth/public.decorator';
import { EntrantesService } from '../bandeja/entrantes.service';
import { verifyMetaSignature } from './meta-webhook.util';

// Adaptado de huarique_backend WhatsappController. Meta llama aquí por la redirección configurada al conectar.
@Public()
// Meta reintenta y manda ráfagas: el webhook no pasa por el límite de peticiones (lo protege la firma).
@SkipThrottle()
@Controller('webhooks/whatsapp')
export class WebhookController {
  constructor(private readonly entrantes: EntrantesService) {}

  @Get()
  verificar(
    @Query('hub.mode') modo: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') reto: string,
  ) {
    const esperado = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    if (modo !== 'subscribe' || !esperado || token !== esperado)
      throw new ForbiddenException();
    return reto;
  }

  @Post()
  @HttpCode(200)
  async recibir(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') firma?: string,
  ) {
    const secreto = process.env.META_APP_SECRET;
    if (!secreto)
      throw new InternalServerErrorException('META_APP_SECRET no configurado');
    if (!verifyMetaSignature(req.rawBody, firma, secreto))
      throw new UnauthorizedException('Firma inválida');
    // Se guarda antes de responder (son pocas consultas): si falla, el 500 hace que Meta reintente
    // en vez de perder el mensaje. Procesar en segundo plano tras el 200 lo perdía si la base fallaba.
    await this.entrantes.procesar(req.body);
    return 'EVENT_RECEIVED';
  }
}
