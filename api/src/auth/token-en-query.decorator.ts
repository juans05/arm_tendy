import { SetMetadata } from '@nestjs/common';

// EventSource (SSE) no puede enviar cabeceras: estas rutas aceptan el token en ?token=.
export const TOKEN_EN_QUERY = 'tokenEnQuery';
export const TokenEnQuery = () => SetMetadata(TOKEN_EN_QUERY, true);
