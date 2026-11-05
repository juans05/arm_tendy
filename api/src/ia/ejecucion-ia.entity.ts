import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Traza de cada llamada a la IA: qué modelo, cuántos tokens, cuánto tardó y qué decidió (o el error).
@Entity('ejecuciones_ia')
export class EjecucionIa {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 200 }) tenant: string;
  @Column({ name: 'conversacion_id', type: 'uuid', nullable: true })
  conversacionId: string | null;
  @Column({ type: 'varchar', length: 20 }) tipo: string;
  @Column({ type: 'varchar', length: 100, nullable: true }) modelo:
    string | null;
  @Column({ name: 'tokens_entrada', type: 'int', default: 0 })
  tokensEntrada: number;
  @Column({ name: 'tokens_salida', type: 'int', default: 0 })
  tokensSalida: number;
  @Column({ type: 'int', default: 0 }) ms: number;
  @Column({ type: 'jsonb', nullable: true }) salida: unknown;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
