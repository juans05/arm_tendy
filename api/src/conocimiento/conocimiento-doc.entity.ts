import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type TipoDoc = 'texto' | 'docx' | 'xlsx' | 'pdf' | 'imagen';

// Documento de la base de conocimiento. Sus fragmentos con embedding viven en conocimiento_fragmentos (SQL directo: pgvector).
@Entity('conocimiento_docs')
export class ConocimientoDoc {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 200 }) tenant: string;
  @Column({ length: 200 }) titulo: string;
  @Column({ type: 'varchar', length: 10 }) tipo: TipoDoc;
  @Column({ type: 'text' }) texto: string;
  // Solo imágenes: la IA puede enviarlas al cliente.
  @Column({ type: 'bytea', nullable: true, select: false })
  archivo: Buffer | null;
  @Column({ type: 'varchar', length: 100, nullable: true }) mime: string | null;
  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}
