import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Miembro, RolMiembro } from './miembro.entity';

export const PERMITIR_PENDIENTE = 'permitirPendiente';
export const PermitirPendiente = () => SetMetadata(PERMITIR_PENDIENTE, true);

export const ROLES = 'roles';
export const Roles = (...roles: RolMiembro[]) => SetMetadata(ROLES, roles);

export const MiembroActual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Miembro =>
    ctx.switchToHttp().getRequest().miembro,
);
