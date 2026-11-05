import { MigrationInterface, QueryRunner } from 'typeorm';

export class Inicial1762300000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // pgvector para la base de conocimiento (bloque 3).
    await q.query('CREATE EXTENSION IF NOT EXISTS vector');
  }

  async down(): Promise<void> {
    // La extensión se deja: otras bases del mismo servidor pueden usarla.
  }
}
