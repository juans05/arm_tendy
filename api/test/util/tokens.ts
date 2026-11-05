import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  JWTVerifyGetKey,
  KeyLike,
  SignJWT,
} from 'jose';

export interface Firmador {
  keySet: JWTVerifyGetKey;
  token(p: {
    userId: string;
    tenant: string;
    nombre?: string;
    apps?: string;
  }): Promise<string>;
}

// Emite tokens como los de PuntoVenta, firmados con una clave RSA de prueba.
export async function crearFirmador(): Promise<Firmador> {
  const par = await generateKeyPair('RS256');
  const privada: KeyLike = par.privateKey;
  const keySet = createLocalJWKSet({
    keys: [{ ...(await exportJWK(par.publicKey)), alg: 'RS256', kid: 'test' }],
  });
  return {
    keySet,
    token: (p) =>
      new SignJWT({
        nameid: p.userId,
        username: p.userId.toUpperCase(),
        nombre: p.nombre ?? p.userId,
        'https://schemas.microsoft.com/identity/claims/tenantid': p.tenant,
        apps: p.apps ?? '["arp","arm"]',
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'test' })
        .setIssuer(process.env.CUENTAS_ISSUER!)
        .setAudience(process.env.CUENTAS_AUDIENCE!)
        .setExpirationTime('1h')
        .sign(privada),
  };
}
