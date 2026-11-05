import { IsNotEmpty, IsString, Length } from 'class-validator';

export class TextoDto {
  @IsString() @Length(1, 200) titulo: string;
  @IsString() @IsNotEmpty() @Length(1, 200_000) texto: string;
}

export class RespuestaDto {
  @IsString() @Length(1, 4000) respuesta: string;
}
