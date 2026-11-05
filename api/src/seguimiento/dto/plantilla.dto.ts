import {
  ArrayMaxSize,
  IsArray,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class EnviarPlantillaDto {
  @Matches(/^[a-z0-9_]{1,512}$/) nombre: string;
  @IsString() @Length(2, 10) idioma: string;
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Length(1, 1000, { each: true })
  parametros: string[];
}
