import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(helmet());
  // Detrás de un proxy (nginx, balanceador) el límite por IP necesita la IP real del cliente.
  if (process.env.TRUST_PROXY === 'true')
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.enableCors({ origin: process.env.WEB_ORIGIN?.split(',') ?? false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3002);
}
bootstrap();
