import 'dotenv/config';
import { DataSource } from 'typeorm';
import { limpiarBase } from './app';

// DataSource contra arm_test para pruebas de servicios, con migraciones y tablas vacías.
export async function crearDbTest(): Promise<DataSource> {
  const db = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL_TEST,
    entities: [__dirname + '/../../src/**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../../src/database/migrations/*{.ts,.js}'],
  });
  await db.initialize();
  await limpiarBase(db);
  return db;
}
