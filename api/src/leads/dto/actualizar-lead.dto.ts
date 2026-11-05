import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Etapa, ETAPAS } from '../lead.entity';

const presente = (_: unknown, v: unknown) => v !== null && v !== undefined;

export class ActualizarLeadDto {
  @IsOptional() @IsIn(ETAPAS) etapa?: Etapa;
  @ValidateIf(presente) @IsUUID() duenoId?: string | null;
  @ValidateIf(presente) @IsUUID() lineaId?: string | null;
  @ValidateIf(presente)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999_999)
  monto?: number | null;
  @ValidateIf(presente) @IsString() @Length(0, 100) plan?: string | null;
  @ValidateIf(presente) @IsString() @Length(0, 500) motivo?: string | null;
}

export class FiltroLeadsDto {
  @IsOptional() @IsIn(ETAPAS) etapa?: Etapa;
  @IsOptional() @IsUUID() lineaId?: string;
  @IsOptional() @IsUUID() duenoId?: string;
}
