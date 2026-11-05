import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolMiembro } from './miembro.entity';
import { ROLES } from './miembros.decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<RolMiembro[]>(ROLES, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles?.length) return true;
    if (roles.includes(ctx.switchToHttp().getRequest().miembro?.rol))
      return true;
    throw new ForbiddenException({
      code: 'SIN_PERMISO',
      message: 'No tienes permiso para esta acción',
    });
  }
}
