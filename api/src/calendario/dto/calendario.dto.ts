import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export class RangoDto {
  @IsDateString() desde: string;
  @IsDateString() hasta: string;
}

export class NuevaCitaDto {
  @IsUUID() miembroId: string;
  @IsDateString() inicio: string;
  @IsOptional() @IsDateString() fin?: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsString() @Length(1, 200) titulo: string;
  @IsOptional() @IsUrl({ require_protocol: true }) link?: string;
  @IsOptional() @IsString() @Length(0, 2000) notas?: string;
}

export class ReprogramarDto {
  @IsDateString() inicio: string;
  @IsOptional() @IsDateString() fin?: string;
}

export class EstadoCitaDto {
  @IsIn(['realizada', 'no_asistio', 'cancelada']) estado:
    'realizada' | 'no_asistio' | 'cancelada';
}

export class FranjaDto {
  @IsInt() @Min(0) @Max(6) dia: number;
  @Matches(HORA) desde: string;
  @Matches(HORA) hasta: string;
}

export class HorariosDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => FranjaDto)
  franjas: FranjaDto[];
}

export class BloqueoDto {
  @IsUUID() miembroId: string;
  @IsDateString() inicio: string;
  @IsDateString() fin: string;
  @IsOptional() @IsString() @Length(0, 200) motivo?: string;
}
