import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type EstadoCita = 'agendada' | 'realizada' | 'no_asistio' | 'cancelada';

// Demo o reunión. La base impide dos citas agendadas que se crucen para el mismo miembro (citas_sin_cruce).
@Entity('citas')
export class Cita {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 200 }) tenant: string;
  @Column({ name: 'lead_id', type: 'uuid', nullable: true }) leadId:
    string | null;
  @Column({ name: 'miembro_id', type: 'uuid' }) miembroId: string;
  @Column({ type: 'timestamptz' }) inicio: Date;
  @Column({ type: 'timestamptz' }) fin: Date;
  @Column({ type: 'varchar', length: 12, default: 'agendada' })
  estado: EstadoCita;
  @Column({ type: 'varchar', length: 10, default: 'manual' }) origen:
    'ia' | 'manual';
  @Column({ length: 200, default: 'Demo' }) titulo: string;
  @Column({ type: 'text', nullable: true }) link: string | null;
  @Column({ type: 'text', nullable: true }) notas: string | null;
  @Column({ name: 'aviso_30', default: false }) aviso30: boolean;
  @Column({ name: 'rec_24', default: false }) rec24: boolean;
  @Column({ name: 'rec_2', default: false }) rec2: boolean;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
