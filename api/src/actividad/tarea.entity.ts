import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Lead } from '../leads/lead.entity';

export type EstadoTarea = 'pendiente' | 'hecha' | 'cancelada';

// Próxima acción sobre un lead. "auto": la creó una automatización al cambiar de etapa.
@Entity('tareas')
export class Tarea {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 200 }) tenant: string;
  @Column({ name: 'lead_id', type: 'uuid' }) leadId: string;
  @ManyToOne(() => Lead, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lead_id' })
  lead?: Lead;
  @Column({ length: 200 }) titulo: string;
  @Column({ name: 'vence_en', type: 'timestamptz', nullable: true })
  venceEn: Date | null;
  @Column({ name: 'responsable_id', type: 'uuid' }) responsableId: string;
  /** null: la creó una automatización. */
  @Column({ name: 'creador_id', type: 'uuid', nullable: true })
  creadorId: string | null;
  @Column({ type: 'varchar', length: 10, default: 'pendiente' })
  estado: EstadoTarea;
  @Column({ type: 'varchar', length: 10, default: 'manual' }) origen:
    'manual' | 'auto';
  @Column({ name: 'hecha_en', type: 'timestamptz', nullable: true })
  hechaEn: Date | null;
  /** Se avisó al responsable que venció: no se repite. */
  @Column({ name: 'aviso_vencida', default: false }) avisoVencida: boolean;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
