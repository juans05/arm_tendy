import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Nota de un miembro sobre un lead. Las @menciones avisan a los compañeros.
@Entity('notas')
export class Nota {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 200 }) tenant: string;
  @Column({ name: 'lead_id', type: 'uuid' }) leadId: string;
  @Column({ name: 'autor_id', type: 'uuid' }) autorId: string;
  @Column({ type: 'text' }) texto: string;
  @Column({ type: 'uuid', array: true, default: '{}' }) menciones: string[];
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
