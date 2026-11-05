import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Miembro } from '../miembros/miembro.entity';

// Lo que vende la empresa (Wuarikes: Barbería, Restaurante, Spa). Cada línea califica y agenda a su manera.
@Entity('lineas_producto')
@Unique(['tenant', 'nombre'])
export class LineaProducto {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 200 }) tenant: string;
  @Column({ length: 100 }) nombre: string;
  @Column({ type: 'text', default: '' }) criterios: string;
  @Column({ name: 'duracion_demo_min', type: 'int', default: 30 }) duracionDemoMin: number;
  @Column({ default: true }) activa: boolean;

  @ManyToMany(() => Miembro)
  @JoinTable({
    name: 'linea_producto_comerciales',
    joinColumn: { name: 'linea_id' },
    inverseJoinColumn: { name: 'miembro_id' },
  })
  comerciales: Miembro[];
}
