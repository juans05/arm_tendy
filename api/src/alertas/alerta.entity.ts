import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type TipoAlerta =
  | 'demo_agendada'
  | 'demo_pronto'
  | 'cliente_respondio'
  | 'lead_asignado'
  | 'pregunta'
  | 'sin_atender'
  | 'resumen_diario'
  | 'seguimiento';

// Campanita de ARM (y, si el miembro tiene celular de alertas, también por WhatsApp).
@Entity('alertas')
export class Alerta {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 200 }) tenant: string;
  @Column({ name: 'miembro_id', type: 'uuid' }) miembroId: string;
  @Column({ type: 'varchar', length: 30 }) tipo: TipoAlerta;
  @Column({ length: 200 }) titulo: string;
  @Column({ type: 'text', default: '' }) detalle: string;
  @Column({ type: 'varchar', length: 300, nullable: true }) enlace:
    string | null;
  @Column({ default: false }) leida: boolean;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
