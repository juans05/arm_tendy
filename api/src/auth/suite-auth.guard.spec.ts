import {
  ExecutionContext,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  createLocalJWKSet,
  errors,
  exportJWK,
  generateKeyPair,
  JWTVerifyGetKey,
  KeyLike,
  SignJWT,
} from 'jose';
import { SuiteAuthGuard } from './suite-auth.guard';
import { IS_PUBLIC } from './public.decorator';
import { TOKEN_EN_QUERY } from './token-en-query.decorator';

const ISS = 'https://wsp-sms-api.initchange.dev';
const AUD = 'https://wsp-sms.initchange.dev';
const TENANT_CLAIM = 'https://schemas.microsoft.com/identity/claims/tenantid';

const claimsBase = {
  nameid: 'u1',
  username: 'JUAN',
  nombre: 'Juan',
  [TENANT_CLAIM]: 'wuarikes',
  apps: '["arp","arm"]',
};

describe('SuiteAuthGuard', () => {
  let privada: KeyLike;
  let keySet: JWTVerifyGetKey;

  beforeAll(async () => {
    const par = await generateKeyPair('RS256');
    privada = par.privateKey;
    keySet = createLocalJWKSet({
      keys: [{ ...(await exportJWK(par.publicKey)), alg: 'RS256', kid: 'k1' }],
    });
  });

  const firmar = (
    claims: Record<string, unknown>,
    opts: { key?: KeyLike; aud?: string; exp?: number | string } = {},
  ) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(ISS)
      .setAudience(opts.aud ?? AUD)
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? '1h')
      .sign(opts.key ?? privada);

  const contexto = (token?: string, publico = false) => {
    const req: any = {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => (publico ? 'publico' : 'privado'),
      getClass: () => 'Clase',
    } as unknown as ExecutionContext;
    return { req, ctx };
  };

  const guard = () => {
    const reflector = {
      getAllAndOverride: (k: string, t: unknown[]) =>
        k === IS_PUBLIC && t[0] === 'publico',
    } as unknown as Reflector;
    return new SuiteAuthGuard(
      reflector,
      keySet,
      new ConfigService({ CUENTAS_ISSUER: ISS, CUENTAS_AUDIENCE: AUD }),
    );
  };

  const codigo = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e: any) {
      return { tipo: e.constructor, res: e.getResponse?.() };
    }
    throw new Error('no lanzó');
  };

  it('acepta RS256 válido con arm', async () => {
    const { req, ctx } = contexto(await firmar(claimsBase));
    expect(await guard().canActivate(ctx)).toBe(true);
    expect(req.user).toEqual({
      userId: 'u1',
      username: 'JUAN',
      nombre: 'Juan',
      tenant: 'wuarikes',
      apps: ['arp', 'arm'],
      exp: expect.any(Number),
    });
  });

  it('rechaza HS256', async () => {
    const hs = await new SignJWT(claimsBase)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(ISS)
      .setAudience(AUD)
      .setExpirationTime('1h')
      .sign(
        new TextEncoder().encode('clave-hmac-de-prueba-suficientemente-larga'),
      );
    expect((await codigo(guard().canActivate(contexto(hs).ctx))).tipo).toBe(
      UnauthorizedException,
    );
  });

  it('rechaza firma de otra clave RSA', async () => {
    const otra = (await generateKeyPair('RS256')).privateKey;
    const t = await firmar(claimsBase, { key: otra });
    expect((await codigo(guard().canActivate(contexto(t).ctx))).tipo).toBe(
      UnauthorizedException,
    );
  });

  it('rechaza vencido', async () => {
    const t = await firmar(claimsBase, {
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    expect((await codigo(guard().canActivate(contexto(t).ctx))).tipo).toBe(
      UnauthorizedException,
    );
  });

  it('rechaza audience distinta', async () => {
    const t = await firmar(claimsBase, { aud: 'https://otra' });
    expect((await codigo(guard().canActivate(contexto(t).ctx))).tipo).toBe(
      UnauthorizedException,
    );
  });

  it('sin token → 401', async () => {
    expect((await codigo(guard().canActivate(contexto().ctx))).tipo).toBe(
      UnauthorizedException,
    );
  });

  it('sin arm → SIN_ARM', async () => {
    const r = await codigo(
      guard().canActivate(
        contexto(await firmar({ ...claimsBase, apps: '["arp"]' })).ctx,
      ),
    );
    expect(r.tipo).toBe(ForbiddenException);
    expect(r.res).toMatchObject({ code: 'SIN_ARM' });
  });

  it.each([[undefined], [''], ['no-json'], ['{"a":1}']])(
    'apps mal formado (%p) → SIN_ARM',
    async (apps) => {
      const claims: Record<string, unknown> = { ...claimsBase, apps };
      if (apps === undefined) delete claims.apps;
      const r = await codigo(
        guard().canActivate(contexto(await firmar(claims)).ctx),
      );
      expect(r.tipo).toBe(ForbiddenException);
      expect(r.res).toMatchObject({ code: 'SIN_ARM' });
    },
  );

  it('sin tenant → 401', async () => {
    const claims: Record<string, unknown> = { ...claimsBase };
    delete claims[TENANT_CLAIM];
    expect(
      (await codigo(guard().canActivate(contexto(await firmar(claims)).ctx)))
        .tipo,
    ).toBe(UnauthorizedException);
  });

  it('tolera desfase de reloj de 30 s (nbf en el futuro)', async () => {
    const t = await new SignJWT(claimsBase)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(ISS)
      .setAudience(AUD)
      .setNotBefore(Math.floor(Date.now() / 1000) + 30)
      .setExpirationTime('1h')
      .sign(privada);
    expect(await guard().canActivate(contexto(t).ctx)).toBe(true);
  });

  it.each([
    ['JWKS sin respuesta', new errors.JWKSTimeout()],
    ['fetch fallido', new TypeError('fetch failed')],
  ])('%s → 503', async (_, error) => {
    const caido = (() => Promise.reject(error)) as unknown as JWTVerifyGetKey;
    const reflector = {
      getAllAndOverride: () => false,
    } as unknown as Reflector;
    const g = new SuiteAuthGuard(
      reflector,
      caido,
      new ConfigService({ CUENTAS_ISSUER: ISS, CUENTAS_AUDIENCE: AUD }),
    );
    expect(
      (await codigo(g.canActivate(contexto(await firmar(claimsBase)).ctx)))
        .tipo,
    ).toBe(ServiceUnavailableException);
  });

  it('@Public pasa sin token', async () => {
    expect(await guard().canActivate(contexto(undefined, true).ctx)).toBe(true);
  });

  describe('token en query', () => {
    // EventSource del navegador no puede enviar cabeceras: las rutas @TokenEnQuery aceptan ?token=.
    const ctxQuery = (token: string, handler: 'sse' | 'normal') => {
      const req: any = { headers: {}, query: { token } };
      const ctx = {
        switchToHttp: () => ({ getRequest: () => req }),
        getHandler: () => handler,
        getClass: () => 'Clase',
      } as unknown as ExecutionContext;
      return { req, ctx };
    };
    const guardQuery = () => {
      const reflector = {
        getAllAndOverride: (k: string, t: unknown[]) =>
          k === TOKEN_EN_QUERY && t[0] === 'sse',
      } as unknown as Reflector;
      return new SuiteAuthGuard(
        reflector,
        keySet,
        new ConfigService({ CUENTAS_ISSUER: ISS, CUENTAS_AUDIENCE: AUD }),
      );
    };

    it('token en query solo en rutas @TokenEnQuery', async () => {
      const { req, ctx } = ctxQuery(await firmar(claimsBase), 'sse');
      expect(await guardQuery().canActivate(ctx)).toBe(true);
      expect(req.user).toMatchObject({ userId: 'u1', tenant: 'wuarikes' });
    });

    it('el mismo token en query en una ruta normal → 401', async () => {
      const { ctx } = ctxQuery(await firmar(claimsBase), 'normal');
      expect((await codigo(guardQuery().canActivate(ctx))).tipo).toBe(
        UnauthorizedException,
      );
    });

    it('token inválido en query → 401', async () => {
      const { ctx } = ctxQuery('basura', 'sse');
      expect((await codigo(guardQuery().canActivate(ctx))).tipo).toBe(
        UnauthorizedException,
      );
    });
  });
});
