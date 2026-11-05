import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class ConfigAgenteDto {
  @IsOptional() @IsIn(['responde', 'propone']) agenteModo?:
    'responde' | 'propone';
  @IsOptional() @IsString() @Length(1, 60) agenteNombre?: string;
  @IsOptional() @IsString() @Length(0, 2000) agenteTono?: string;
  @IsOptional() @IsString() @Length(0, 5000) producto?: string;
}
