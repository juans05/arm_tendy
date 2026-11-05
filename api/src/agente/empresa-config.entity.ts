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
  /** Zona horaria IANA: horarios, recordatorios y reportes se calculan en ella. */
  @Column({ name: 'zona_horaria', length: 50, default: 'America/Lima' })
  zonaHoraria: string;
  @Column({ name: 'margen_citas_min', type: 'int', default: 10 })
  margenCitasMin: number;
  @Column({ name: 'seguimiento_dias_1', type: 'int', default: 3 })
  seguimientoDias1: number;
  @Column({ name: 'seguimiento_dias_2', type: 'int', default: 7 })
  seguimientoDias2: number;
  @Column({ name: 'minutos_sin_atender', type: 'int', default: 15 })
  minutosSinAtender: number;
  /** Plantillas aprobadas por Meta (nombre) para escribir fuera de la ventana de 24 h. */
  @Column({
    name: 'plantilla_seguimiento',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  plantillaSeguimiento: string | null;
  @Column({
    name: 'plantilla_recordatorio',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  plantillaRecordatorio: string | null;
  @Column({
    name: 'plantilla_alerta',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  plantillaAlerta: string | null;
  @Column({ name: 'idioma_plantillas', length: 10, default: 'es' })
  idiomaPlantillas: string;
  @Column({ name: 'resumen_enviado', type: 'date', nullable: true })
  resumenEnviado: string | null;
}

export const configPorDefecto = (tenant: string): EmpresaConfig => ({
  tenant,
  agenteModo: 'responde',
  agenteNombre: 'Asistente',
  agenteTono: '',
  producto: '',
  zonaHoraria: 'America/Lima',
  margenCitasMin: 10,
  seguimientoDias1: 3,
  seguimientoDias2: 7,
  minutosSinAtender: 15,
  plantillaSeguimiento: null,
  plantillaRecordatorio: null,
  plantillaAlerta: null,
  idiomaPlantillas: 'es',
  resumenEnviado: null,
});
