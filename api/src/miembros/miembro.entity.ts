import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export type RolMiembro = 'gerente' | 'comercial';
export type EstadoMiembro = 'pendiente' | 'activo' | 'inactivo';

@Entity('miembros')
@Unique(['tenant', 'userId'])
export class Miembro {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 200 }) tenant: string;
  @Column({ name: 'user_id', length: 100 }) userId: string;
  @Column({ length: 100 }) username: string;
  @Column({ length: 200 }) nombre: string;
  @Column({ type: 'varchar', length: 20 }) rol: RolMiembro;
  @Column({ type: 'varchar', length: 20 }) estado: EstadoMiembro;
  @Column({
    name: 'celular_alertas',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  celularAlertas: string | null;
  @Column({ name: 'recibe_demos', default: false }) recibeDemos: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
