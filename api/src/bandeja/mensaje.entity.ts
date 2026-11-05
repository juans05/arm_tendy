import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Referral } from '../canales/meta-webhook.util';
import { Conversacion } from './conversacion.entity';

export type Direccion = 'entrante' | 'saliente';
export type Origen = 'cliente' | 'humano' | 'app_celular' | 'ia';

@Entity('mensajes')
@Index(['conversacionId', 'createdAt'])
export class Mensaje {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 200 }) tenant: string;
  @Column({ name: 'conversacion_id', type: 'uuid' }) conversacionId: string;
  @ManyToOne(() => Conversacion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversacion_id' })
  conversacion?: Conversacion;
  @Column({ type: 'varchar', length: 10 }) direccion: Direccion;
  @Column({ type: 'varchar', length: 15 }) origen: Origen;
  @Column({ type: 'varchar', length: 20 }) tipo: string;
  @Column({ type: 'text', nullable: true }) texto: string | null;
  @Column({ name: 'media_id', type: 'varchar', length: 100, nullable: true })
  mediaId: string | null;
  @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;
  // Único: Meta reintenta los webhooks y el mismo mensaje no debe guardarse dos veces.
  @Column({
    name: 'wa_message_id',
    type: 'varchar',
    length: 100,
    nullable: true,
    unique: true,
  })
  waMessageId: string | null;
  @Column({ type: 'jsonb', nullable: true }) referral: Referral | null;
  @Column({ name: 'autor_miembro_id', type: 'uuid', nullable: true })
  autorMiembroId: string | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
