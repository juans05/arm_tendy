import {
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Opcional } from '../../common/opcional.decorator';

export class GuardarLineaDto {
  @IsString() @Length(1, 100) nombre: string;
  @Opcional() @IsString() @MaxLength(4000) criterios?: string;
  @Opcional() @IsInt() @Min(15) @Max(180) duracionDemoMin?: number;
  @Opcional() @IsBoolean() activa?: boolean;
  @Opcional() @IsArray() @IsUUID('all', { each: true }) comercialIds?: string[];
}

export class ActualizarLineaDto {
  @Opcional() @IsString() @Length(1, 100) nombre?: string;
  @Opcional() @IsString() @MaxLength(4000) criterios?: string;
  @Opcional() @IsInt() @Min(15) @Max(180) duracionDemoMin?: number;
  @Opcional() @IsBoolean() activa?: boolean;
  @Opcional() @IsArray() @IsUUID('all', { each: true }) comercialIds?: string[];
}
