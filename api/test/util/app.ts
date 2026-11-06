import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { DataSource } from 'typeorm';

// App contra la base de pruebas, con migraciones aplicadas y tablas vacías.
export async function crearApp(
  overrides: (b: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<INestApplication> {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
  // El barrido de cada minuto tocaría la base mientras las pruebas la vacían.
  process.env.BARRIDO ??= 'off';
  process.env.LIMITE_POR_MINUTO ??= '100000';
  // Contador en memoria: en Redis quedaría entre corridas (el almacenamiento en Redis tiene su prueba).
  process.env.LIMITE_REDIS ??= 'off';
  const { AppModule } = await import('../../src/app.module');
  const modulo = await overrides(
    Test.createTestingModule({ imports: [AppModule] }),
  ).compile();
  const app = modulo.createNestApplication({ rawBody: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  await limpiarBase(app.get(DataSource));
  return app;
}

export async function limpiarBase(db: DataSource): Promise<void> {
  await db.runMigrations();
  const tablas: { tablename: string }[] = await db.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'migrations'",
  );
  if (tablas.length)
    await db.query(
      `TRUNCATE ${tablas.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`,
    );
}
