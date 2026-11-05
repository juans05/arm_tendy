import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createLocalJWKSet, exportJWK, generateKeyPair, JWTVerifyGetKey, KeyLike, SignJWT } from 'jose';
import { SuiteAuthGuard } from './suite-auth.guard';
import { IS_PUBLIC } from './public.decorator';

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
    keySet = createLocalJWKSet({ keys: [{ ...(await exportJWK(par.publicKey)), alg: 'RS256', kid: 'k1' }] });
  });

  const firmar = (claims: Record<string, unknown>, opts: { key?: KeyLike; aud?: string; exp?: number | string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(ISS)
      .setAudience(opts.aud ?? AUD)
      .setIssuedAt()
      .setExpirationTime(opts.exp ?? '1h')
      .sign(opts.key ?? privada);

  const contexto = (token?: string, publico = false) => {
    const req: any = { headers: token ? { authorization: `Bearer ${token}` } : {} };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => (publico ? 'publico' : 'privado'),
      getClass: () => 'Clase',
    } as unknown as ExecutionContext;
    return { req, ctx };
  };

  const guard = () => {
    const reflector = { getAllAndOverride: (k: string, t: unknown[]) => k === IS_PUBLIC && t[0] === 'publico' } as unknown as Reflector;
    return new SuiteAuthGuard(reflector, keySet, new ConfigService({ CUENTAS_ISSUER: ISS, CUENTAS_AUDIENCE: AUD }));
  };

  const codigo = async (p: Promise<unknown>) => {
    try { await p; } catch (e: any) { return { tipo: e.constructor, res: e.getResponse?.() }; }
    throw new Error('no lanzó');
  };

  it('acepta RS256 válido con arm', async () => {
    const { req, ctx } = contexto(await firmar(claimsBase));
    expect(await guard().canActivate(ctx)).toBe(true);
    expect(req.user).toEqual({ userId: 'u1', username: 'JUAN', nombre: 'Juan', tenant: 'wuarikes', apps: ['arp', 'arm'] });
  });

  it('rechaza HS256', async () => {
    const hs = await new SignJWT(claimsBase).setProtectedHeader({ alg: 'HS256' }).setIssuer(ISS).setAudience(AUD)
      .setExpirationTime('1h').sign(new TextEncoder().encode('clave-hmac-de-prueba-suficientemente-larga'));
    expect((await codigo(guard().canActivate(contexto(hs).ctx))).tipo).toBe(UnauthorizedException);
  });

  it('rechaza firma de otra clave RSA', async () => {
    const otra = (await generateKeyPair('RS256')).privateKey;
    const t = await firmar(claimsBase, { key: otra });
    expect((await codigo(guard().canActivate(contexto(t).ctx))).tipo).toBe(UnauthorizedException);
  });

  it('rechaza vencido', async () => {
    const t = await firmar(claimsBase, { exp: Math.floor(Date.now() / 1000) - 60 });
    expect((await codigo(guard().canActivate(contexto(t).ctx))).tipo).toBe(UnauthorizedException);
  });

  it('rechaza audience distinta', async () => {
    const t = await firmar(claimsBase, { aud: 'https://otra' });
    expect((await codigo(guard().canActivate(contexto(t).ctx))).tipo).toBe(UnauthorizedException);
  });

  it('sin token → 401', async () => {
    expect((await codigo(guard().canActivate(contexto().ctx))).tipo).toBe(UnauthorizedException);
  });

  it('sin arm → SIN_ARM', async () => {
    const r = await codigo(guard().canActivate(contexto(await firmar({ ...claimsBase, apps: '["arp"]' })).ctx));
    expect(r.tipo).toBe(ForbiddenException);
    expect(r.res).toMatchObject({ code: 'SIN_ARM' });
  });

  it.each([[undefined], [''], ['no-json'], ['{"a":1}']])('apps mal formado (%p) → SIN_ARM', async (apps) => {
    const claims: Record<string, unknown> = { ...claimsBase, apps };
    if (apps === undefined) delete claims.apps;
    const r = await codigo(guard().canActivate(contexto(await firmar(claims)).ctx));
    expect(r.tipo).toBe(ForbiddenException);
    expect(r.res).toMatchObject({ code: 'SIN_ARM' });
  });

  it('sin tenant → 401', async () => {
    const claims: Record<string, unknown> = { ...claimsBase };
    delete claims[TENANT_CLAIM];
    expect((await codigo(guard().canActivate(contexto(await firmar(claims)).ctx))).tipo).toBe(UnauthorizedException);
  });

  it('@Public pasa sin token', async () => {
    expect(await guard().canActivate(contexto(undefined, true).ctx)).toBe(true);
  });
});
