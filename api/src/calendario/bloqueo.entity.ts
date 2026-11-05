import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bloqueos')
export class Bloqueo {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 200 }) tenant: string;
  @Column({ name: 'miembro_id', type: 'uuid' }) miembroId: string;
  @Column({ type: 'timestamptz' }) inicio: Date;
  @Column({ type: 'timestamptz' }) fin: Date;
  @Column({ type: 'text', default: '' }) motivo: string;
}
