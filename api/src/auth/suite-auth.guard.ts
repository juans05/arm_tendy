import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { errors, jwtVerify, JWTVerifyGetKey } from 'jose';
import { JWKS_KEY_SET } from './jwks.provider';
import { IS_PUBLIC } from './public.decorator';
import { TOKEN_EN_QUERY } from './token-en-query.decorator';
import { parseApps, SuiteUser, TENANT_CLAIM } from './suite-user';

// Valida el token del staff que emite PuntoVenta (Cuentas). Solo RS256: la clave HMAC de PuntoVenta no sirve aquí.
@Injectable()
export class SuiteAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(JWKS_KEY_SET) private keySet: JWTVerifyGetKey,
    private config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets))
      return true;

    const req = ctx.switchToHttp().getRequest();
    let [tipo, token] = (req.headers?.authorization ?? '').split(' ');
    const enQuery = req.query?.token;
    if (
      !token &&
      typeof enQuery === 'string' &&
      this.reflector.getAllAndOverride<boolean>(TOKEN_EN_QUERY, targets)
    ) {
      [tipo, token] = ['Bearer', enQuery];
    }
    if (tipo !== 'Bearer' || !token)
      throw new UnauthorizedException('Falta el token');

    let payload: Record<string, unknown>;
    try {
      ({ payload } = await jwtVerify(token, this.keySet, {
        algorithms: ['RS256'],
        issuer: this.config.getOrThrow<string>('CUENTAS_ISSUER'),
        audience: this.config.getOrThrow<string>('CUENTAS_AUDIENCE'),
        // PuntoVenta emite nbf = ahora: un reloj algo atrasado aquí no debe rechazar un token recién emitido.
        clockTolerance: 60,
      }));
    } catch (e) {
      // Si no se pudo traer la clave pública de Cuentas, el token no es culpable: 503, no 401 (que borra la sesión).
      if (e instanceof errors.JWKSTimeout || !(e instanceof errors.JOSEError)) {
        throw new ServiceUnavailableException({
          code: 'CUENTAS_NO_DISPONIBLE',
          message: 'No se pudo validar la sesión con Cuentas',
        });
      }
      throw new UnauthorizedException('Token inválido o vencido');
    }

    const tenant = payload[TENANT_CLAIM];
    const userId = payload.nameid;
    if (
      typeof tenant !== 'string' ||
      !tenant ||
      typeof userId !== 'string' ||
      !userId
    ) {
      throw new UnauthorizedException('Token sin empresa o usuario');
    }

    const apps = parseApps(payload.apps);
    if (!apps.includes('arm'))
      throw new ForbiddenException({
        code: 'SIN_ARM',
        message: 'Tu empresa no tiene ARM contratado',
      });

    const user: SuiteUser = {
      userId,
      username: String(payload.username ?? ''),
      nombre: String(payload.nombre ?? ''),
      tenant,
      apps,
      exp: typeof payload.exp === 'number' ? payload.exp : undefined,
    };
    req.user = user;
    return true;
  }
}
