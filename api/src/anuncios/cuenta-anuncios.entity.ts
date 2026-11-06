import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { cifrado } from '../common/encryption.transformer';

// Cuenta publicitaria de Meta de la empresa: de aquí sale el gasto para el costo por lead, demo y venta.
@Entity('cuentas_anuncios')
export class CuentaAnuncios {
  @PrimaryColumn({ length: 200 }) tenant: string;
  @Column({ name: 'cuenta_id', length: 50 }) cuentaId: string;
  @Column({ length: 200 }) nombre: string;
  @Column({ length: 10 }) moneda: string;
  @Column({ type: 'text', transformer: cifrado }) token: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
