import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

const ID = /^\d{5,30}$/;

export class ConectarDto {
  @IsString() @IsNotEmpty() code: string;
  @Matches(ID) wabaId: string;
  @IsOptional() @Matches(ID) phoneNumberId?: string;
  @IsOptional() @IsBoolean() coexistencia?: boolean;
}

export class ConectarExistenteDto {
  @Matches(ID) phoneNumberId: string;
  @Matches(ID) wabaId: string;
  @IsString() @IsNotEmpty() token: string;
}
