# Seguridad

## Controles

| Riesgo | Control |
|---|---|
| Sesión falsificada | Token RS256 de Cuentas validado contra su JWKS (issuer, audience, vencimiento, claim `apps` con `arm`) |
| Acceso a otra empresa | Toda consulta filtra por `tenant`; pruebas e2e de aislamiento en bandeja, agente y leads |
| Escalada de rol | Guards globales en orden: límite → token → miembro activo → rol. Miembros desactivados pierden el SSE en el siguiente chequeo |
| Webhook falso | Firma HMAC `x-hub-signature-256` con `META_APP_SECRET`; idempotencia por `wa_message_id` |
| Tokens de Meta en la base | Cifrados con AES-256-GCM (`FIELD_ENCRYPTION_KEY`) |
| Abuso de la API | `@nestjs/throttler`: 300 peticiones por minuto e IP, contadas en Redis para todas las instancias (el webhook queda fuera; lo protege la firma) |
| Cabeceras | `helmet` en la API; CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` y `Permissions-Policy` en la web |
| Inyección en la IA | Reglas en el mensaje de sistema, contenido del cliente como datos, salida validada contra lista blanca |
| Entradas | `ValidationPipe` con `whitelist`; archivos ≤ 10 MB y tipos permitidos; media de Meta ≤ 25 MB |
| Archivos del cliente | Se sirven como adjunto; la web solo muestra imágenes, audio, video y PDF (un HTML o SVG se baja, no se abre) |
| Tiempo real | El SSE filtra por miembro: un comercial solo recibe eventos de sus chats y de los sin dueño, y sus propias alertas |
| Spam a clientes | Baja (`no_contactar`) respetada por seguimiento, recordatorios y plantillas |

## Pendientes

- **TypeORM 0.3**: `npm audit` reporta 3 avisos moderados en `glob`/`minimatch`, que TypeORM usa solo para cargar entidades y migraciones con patrones propios (no con datos de usuarios). Se cierran con TypeORM 1.x junto con NestJS 12.
- El token viaja en la URL solo en `GET /eventos` (EventSource no admite cabeceras); los logs del proxy no deben guardar query strings.
- El token se guarda en `localStorage`; cambiar a cookie `httpOnly` cuando Cuentas lo soporte.

## Reportar un problema

Escribir a contacto@wuarikes.com con los pasos para reproducirlo. No abrir issues públicos con detalles de explotación.
