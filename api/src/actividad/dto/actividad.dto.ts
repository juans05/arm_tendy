import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Etapa, ETAPAS } from '../../leads/lead.entity';
import { ORDENES } from '../../leads/leads.service';

const presente = (_: unknown, v: unknown) => v !== null && v !== undefined;
/** En la URL llegan como texto ("a,b", "true"); en el cuerpo de una vista, ya tipados. */
const lista = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.split(',').filter(Boolean) : value;
const booleano = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class NotaDto {
  @IsString() @Length(1, 5000) texto: string;
}

export class TareaDto {
  @IsString() @Length(1, 200) titulo: string;
  @ValidateIf(presente) @IsISO8601() venceEn?: string | null;
  @IsOptional() @IsUUID() responsableId?: string;
}

export class CambioTareaDto {
  @IsOptional() @IsString() @Length(1, 200) titulo?: string;
  @ValidateIf(presente) @IsISO8601() venceEn?: string | null;
  @IsOptional() @IsUUID() responsableId?: string;
  @IsOptional()
  @IsIn(['pendiente', 'hecha', 'cancelada'])
  estado?: 'pendiente' | 'hecha' | 'cancelada';
}

export class FiltroTareasDto {
  @IsOptional() @IsIn(['pendiente', 'hecha']) estado?: 'pendiente' | 'hecha';
  @IsOptional() @Transform(booleano) @IsBoolean() todas?: boolean;
}

export class FiltroTablaDto {
  @IsOptional() @IsString() @Length(0, 100) q?: string;
  @IsOptional()
  @Transform(lista)
  @IsIn(ETAPAS, { each: true })
  etapas?: Etapa[];
  @IsOptional() @IsUUID() lineaId?: string;
  @IsOptional()
  @Matches(
    /^(sin|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
  )
  duenoId?: string;
  @IsOptional() @Transform(booleano) @IsBoolean() calificado?: boolean;
  @IsOptional() @IsIn(ORDENES) orden?: (typeof ORDENES)[number];
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  pagina?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  porPagina?: number;
}

export class VistaDto {
  @IsString() @Length(1, 60) nombre: string;
  @IsObject()
  @ValidateNested()
  @Type(() => FiltroTablaDto)
  filtros: FiltroTablaDto;
  @IsBoolean() compartida: boolean;
}
