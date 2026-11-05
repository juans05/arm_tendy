import { IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min } from 'class-validator';

export class GuardarLineaDto {
  @IsString() @Length(1, 100) nombre: string;
  @IsOptional() @IsString() @MaxLength(4000) criterios?: string;
  @IsOptional() @IsInt() @Min(15) @Max(180) duracionDemoMin?: number;
  @IsOptional() @IsBoolean() activa?: boolean;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) comercialIds?: string[];
}

export class ActualizarLineaDto {
  @IsOptional() @IsString() @Length(1, 100) nombre?: string;
  @IsOptional() @IsString() @MaxLength(4000) criterios?: string;
  @IsOptional() @IsInt() @Min(15) @Max(180) duracionDemoMin?: number;
  @IsOptional() @IsBoolean() activa?: boolean;
  @IsOptional() @IsArray() @IsUUID('all', { each: true }) comercialIds?: string[];
}
