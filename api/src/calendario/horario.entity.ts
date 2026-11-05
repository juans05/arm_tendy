import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Franja semanal de atención de un miembro, en hora local de la empresa. dia: 0 = domingo. */
@Entity('horarios')
export class Horario {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 200 }) tenant: string;
  @Column({ name: 'miembro_id', type: 'uuid' }) miembroId: string;
  @Column({ type: 'smallint' }) dia: number;
  /** "HH:MM:SS" */
  @Column({ type: 'time' }) desde: string;
  @Column({ type: 'time' }) hasta: string;
}
