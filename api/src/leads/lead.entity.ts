import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Referral } from '../canales/meta-webhook.util';
import { Contacto } from '../bandeja/contacto.entity';

export const ETAPAS = [
  'nuevo',
  'en_conversacion',
  'demo_agendada',
  'demo_realizada',
  'no_asistio',
  'ganado',
  'perdido',
  'seguimiento',
  'archivado',
  'descartado',
] as const;
export type Etapa = (typeof ETAPAS)[number];

/** Dato del cliente con la frase que lo respalda. */
export type DatoLead = { valor: string; evidencia: string };

// Un lead por conversación: lo llena la IA y lo trabaja el comercial.
@Entity('leads')
export class Lead {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 200 }) tenant: string;
  @Column({ name: 'conversacion_id', type: 'uuid', unique: true })
  conversacionId: string;
  @Column({ name: 'contacto_id', type: 'uuid' }) contactoId: string;
  @ManyToOne(() => Contacto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contacto_id' })
  contacto?: Contacto;
  @Column({ name: 'linea_id', type: 'uuid', nullable: true })
  lineaId: string | null;
  @Column({ type: 'varchar', length: 20, default: 'nuevo' }) etapa: Etapa;
  @Column({ name: 'etapa_en', type: 'timestamptz', default: () => 'now()' })
  etapaEn: Date;
  @Column({ default: false }) calificado: boolean;
  @Column({ type: 'int', default: 0 }) puntaje: number;
  @Column({ type: 'jsonb', default: {} }) datos: Record<string, DatoLead>;
  @Column({ type: 'jsonb', default: [] }) sugerencias: string[];
  @Column({ name: 'dueno_id', type: 'uuid', nullable: true })
  duenoId: string | null;
  @Column({ type: 'text', nullable: true }) motivo: string | null;
  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : Number(v)),
    },
  })
  monto: number | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) plan: string | null;
  @Column({ type: 'jsonb', nullable: true }) referral: Referral | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
