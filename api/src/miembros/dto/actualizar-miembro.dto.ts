import { IsBoolean, IsIn, IsOptional, Matches, ValidateIf } from 'class-validator';
import { Opcional } from '../../common/opcional.decorator';
import { EstadoMiembro, RolMiembro } from '../miembro.entity';

export class ActualizarMiembroDto {
  @Opcional() @IsIn(['gerente', 'comercial']) rol?: RolMiembro;
  @Opcional() @IsIn(['pendiente', 'activo', 'inactivo']) estado?: EstadoMiembro;
  // null borra el celular.
  @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(/^\+?\d{9,15}$/, { message: 'Celular inválido' }) celularAlertas?: string | null;
  @Opcional() @IsBoolean() recibeDemos?: boolean;
}
