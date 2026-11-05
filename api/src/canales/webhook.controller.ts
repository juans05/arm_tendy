import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  InternalServerErrorException,
  Logger,
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
@Controller('webhooks/whatsapp')
export class WebhookController {
  private readonly log = new Logger(WebhookController.name);

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
  recibir(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') firma?: string,
  ) {
    const secreto = process.env.META_APP_SECRET;
    if (!secreto)
      throw new InternalServerErrorException('META_APP_SECRET no configurado');
    if (!verifyMetaSignature(req.rawBody, firma, secreto))
      throw new UnauthorizedException('Firma inválida');
    // Meta exige respuesta rápida: se procesa después de responder.
    setImmediate(() =>
      this.entrantes
        .procesar(req.body)
        .catch((e: Error) => this.log.error(`webhook: ${e.message}`, e.stack)),
    );
    return 'EVENT_RECEIVED';
  }
}
