import 'dotenv/config';
import { DataSource } from 'typeorm';

// Para la CLI de TypeORM (migration:generate / migration:run).
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
