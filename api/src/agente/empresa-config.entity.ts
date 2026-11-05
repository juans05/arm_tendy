import { Column, Entity, PrimaryColumn } from 'typeorm';

export type ModoAgente = 'responde' | 'propone';

// Ajustes de ARM por empresa. Sin fila se usan los valores por defecto de `configPorDefecto`.
@Entity('empresas_config')
export class EmpresaConfig {
  @PrimaryColumn({ length: 200 }) tenant: string;
  @Column({
    name: 'agente_modo',
    type: 'varchar',
    length: 10,
    default: 'responde',
  })
  agenteModo: ModoAgente;
  @Column({ name: 'agente_nombre', length: 60, default: 'Asistente' })
  agenteNombre: string;
  @Column({ name: 'agente_tono', type: 'text', default: '' })
  agenteTono: string;
  @Column({ type: 'text', default: '' }) producto: string;
}

export const configPorDefecto = (tenant: string): EmpresaConfig => ({
  tenant,
  agenteModo: 'responde',
  agenteNombre: 'Asistente',
  agenteTono: '',
  producto: '',
});
