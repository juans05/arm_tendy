import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { FiltroTabla } from '../leads/leads.service';

// Filtros guardados de la tabla de leads. Compartida: la ve todo el equipo.
@Entity('vistas')
export class Vista {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 200 }) tenant: string;
  @Column({ name: 'miembro_id', type: 'uuid' }) miembroId: string;
  @Column({ length: 60 }) nombre: string;
  @Column({ type: 'jsonb', default: {} }) filtros: FiltroTabla;
  @Column({ default: false }) compartida: boolean;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
