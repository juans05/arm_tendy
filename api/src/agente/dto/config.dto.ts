import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsTimeZone,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

const PLANTILLA = /^[a-z0-9_]{1,100}$/;

export class ConfigAgenteDto {
  @IsOptional() @IsIn(['responde', 'propone']) agenteModo?:
    'responde' | 'propone';
  @IsOptional() @IsString() @Length(1, 60) agenteNombre?: string;
  @IsOptional() @IsString() @Length(0, 2000) agenteTono?: string;
  @IsOptional() @IsString() @Length(0, 5000) producto?: string;
  @IsOptional() @IsTimeZone() zonaHoraria?: string;
  @IsOptional() @IsInt() @Min(0) @Max(120) margenCitasMin?: number;
  @IsOptional() @IsInt() @Min(1) @Max(60) seguimientoDias1?: number;
  @IsOptional() @IsInt() @Min(1) @Max(90) seguimientoDias2?: number;
  @IsOptional() @IsInt() @Min(5) @Max(240) minutosSinAtender?: number;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(PLANTILLA)
  plantillaSeguimiento?: string | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(PLANTILLA)
  plantillaRecordatorio?: string | null;
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(PLANTILLA)
  plantillaAlerta?: string | null;
  @IsOptional() @IsString() @Length(2, 10) idiomaPlantillas?: string;
}
