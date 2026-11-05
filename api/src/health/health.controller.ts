import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private db: DataSource) {}

  @Get()
  async salud() {
    await this.db.query('SELECT 1');
    return { ok: true, db: true };
  }
}
