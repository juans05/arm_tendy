import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet } from 'jose';

export const JWKS_KEY_SET = 'JWKS_KEY_SET';

// Clave pública de Cuentas (PuntoVenta). jose la cachea y la recarga cuando aparece un kid nuevo.
export const jwksProvider: Provider = {
  provide: JWKS_KEY_SET,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    createRemoteJWKSet(new URL('/.well-known/jwks.json', config.getOrThrow<string>('CUENTAS_URL'))),
};
