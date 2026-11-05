import { IsBoolean, IsIn, IsOptional, Matches, ValidateIf } from 'class-validator';
import { EstadoMiembro, RolMiembro } from '../miembro.entity';

export class ActualizarMiembroDto {
  @IsOptional() @IsIn(['gerente', 'comercial']) rol?: RolMiembro;
  @IsOptional() @IsIn(['pendiente', 'activo', 'inactivo']) estado?: EstadoMiembro;
  // null borra el celular.
  @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(/^\+?\d{9,15}$/, { message: 'Celular inválido' }) celularAlertas?: string | null;
  @IsOptional() @IsBoolean() recibeDemos?: boolean;
}
