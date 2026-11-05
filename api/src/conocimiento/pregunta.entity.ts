import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type EstadoPregunta =
  'abierta' | 'respondida' | 'aprobada' | 'descartada';

// Lo que la IA no supo responder. Un humano responde; un gerente aprueba pasarlo a la base de conocimiento.
@Entity('preguntas')
export class Pregunta {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 200 }) tenant: string;
  @Column({ name: 'conversacion_id', type: 'uuid', nullable: true })
  conversacionId: string | null;
  @Column({ type: 'text' }) pregunta: string;
  @Column({ type: 'text', nullable: true }) respuesta: string | null;
  @Column({ type: 'varchar', length: 12, default: 'abierta' })
  estado: EstadoPregunta;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
