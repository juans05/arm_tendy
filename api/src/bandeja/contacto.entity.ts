import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('contactos')
@Unique(['tenant', 'telefono'])
export class Contacto {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 200 }) tenant: string;
  @Column({ length: 20 }) telefono: string;
  @Column({ length: 200 }) nombre: string;
  // Pidió no ser contactado: no se le envían seguimientos ni recordatorios.
  @Column({ name: 'no_contactar', default: false }) noContactar: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
