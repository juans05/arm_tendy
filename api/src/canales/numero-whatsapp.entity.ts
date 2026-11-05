import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { cifrado } from '../common/encryption.transformer';

@Entity('numeros_whatsapp')
export class NumeroWhatsapp {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 200 }) tenant: string;
  // Único en todo ARM: un número pertenece a una sola empresa.
  @Column({ name: 'phone_number_id', length: 50, unique: true })
  phoneNumberId: string;
  @Column({ name: 'waba_id', length: 50 }) wabaId: string;
  @Column({ length: 20 }) telefono: string;
  @Column({
    name: 'nombre_verificado',
    type: 'varchar',
    length: 200,
    nullable: true,
  })
  nombreVerificado: string | null;
  @Column({ type: 'text', transformer: cifrado }) token: string;
  @Column({ default: false }) coexistencia: boolean;
  @Column({ default: true }) activo: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

export type NumeroPublico = Pick<
  NumeroWhatsapp,
  'id' | 'telefono' | 'nombreVerificado' | 'coexistencia' | 'activo'
>;

export const publico = (n: NumeroWhatsapp): NumeroPublico => ({
  id: n.id,
  telefono: n.telefono,
  nombreVerificado: n.nombreVerificado,
  coexistencia: n.coexistencia,
  activo: n.activo,
});
