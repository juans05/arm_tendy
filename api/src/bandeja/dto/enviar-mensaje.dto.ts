import { IsString, Length } from 'class-validator';

export class EnviarMensajeDto {
  @IsString() @Length(1, 4096) texto: string;
}
