import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '../auth/public.decorator';
import { PERMITIR_PENDIENTE } from './miembros.decorators';
import { MiembrosService } from './miembros.service';

// Corre después de SuiteAuthGuard: registra al usuario como miembro y exige que esté activo.
@Injectable()
export class MiembroActivoGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private miembros: MiembrosService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets))
      return true;

    const req = ctx.switchToHttp().getRequest();
    req.miembro = await this.miembros.entrar(req.user);
    if (
      req.miembro.estado === 'activo' ||
      this.reflector.getAllAndOverride<boolean>(PERMITIR_PENDIENTE, targets)
    )
      return true;

    throw new ForbiddenException(
      req.miembro.estado === 'pendiente'
        ? {
            code: 'MIEMBRO_PENDIENTE',
            message: 'Tu acceso está pendiente de aprobación del gerente',
          }
        : {
            code: 'MIEMBRO_INACTIVO',
            message: 'Tu acceso a ARM está desactivado',
          },
    );
  }
}
