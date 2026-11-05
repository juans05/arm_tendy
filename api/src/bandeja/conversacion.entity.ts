import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { NumeroWhatsapp } from '../canales/numero-whatsapp.entity';
import { Contacto } from './contacto.entity';

export type ModoConversacion = 'ia' | 'humano';

@Entity('conversaciones')
@Unique(['numeroId', 'contactoId'])
export class Conversacion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 200 }) tenant: string;
  @Column({ name: 'numero_id', type: 'uuid' }) numeroId: string;
  @ManyToOne(() => NumeroWhatsapp, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'numero_id' }) numero?: NumeroWhatsapp;
  @Column({ name: 'contacto_id', type: 'uuid' }) contactoId: string;
  @ManyToOne(() => Contacto, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'contacto_id' }) contacto?: Contacto;
  @Column({ type: 'varchar', length: 10, default: 'ia' }) modo: ModoConversacion;
  @Column({ name: 'ultimo_mensaje_en', type: 'timestamptz', default: () => 'now()' }) ultimoMensajeEn: Date;
  @Column({ name: 'ultimo_entrante_en', type: 'timestamptz', nullable: true }) ultimoEntranteEn: Date | null;
  @Column({ name: 'no_leidos', type: 'int', default: 0 }) noLeidos: number;
}
