import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private config: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      url: this.config.getOrThrow<string>('DATABASE_URL'),
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
      synchronize: false,
      migrationsRun: this.config.get('DB_MIGRATIONS_RUN') === 'true',
      ssl:
        this.config.get('DB_SSL') === 'true'
          ? { rejectUnauthorized: false }
          : false,
      logging: ['error'],
    };
  }
}
