import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Cada cambio de etapa de un lead: con esto se calculan tasas de paso y tiempos entre etapas.
@Entity('lead_historial')
export class LeadHistorial {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 200 }) tenant: string;
  @Column({ name: 'lead_id', type: 'uuid' }) leadId: string;
  @Column({ type: 'varchar', length: 20, nullable: true }) de: string | null;
  @Column({ type: 'varchar', length: 20 }) a: string;
  /** null: lo hizo la IA o el sistema. */
  @Column({ name: 'miembro_id', type: 'uuid', nullable: true })
  miembroId: string | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) en: Date;
}
