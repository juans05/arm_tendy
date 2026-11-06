# Despliegue

## Servicios

| Servicio | Imagen | Puerto |
|---|---|---|
| API | `api/Dockerfile` | 3002 |
| Web | `web/Dockerfile` (Next standalone) | 3100 |
| Postgres 16 + pgvector | `pgvector/pgvector:pg16` | 5432 |
| Redis 7 | `redis:7` | 6379 |

## Variables

API: ver `api/.env.example`. Obligatorias en producción: `DATABASE_URL`, `REDIS_URL`, `CUENTAS_URL`, `CUENTAS_ISSUER`, `CUENTAS_AUDIENCE`, `WEB_ORIGIN`, `META_APP_ID`, `META_APP_SECRET`, `META_EMBEDDED_SIGNUP_CONFIG_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `ARM_PUBLIC_URL`, `FIELD_ENCRYPTION_KEY`, `DB_MIGRATIONS_RUN=true`. Para la IA: `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_EMBED_MODEL`. Detrás de un proxy: `TRUST_PROXY=true`.

Web (al construir): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_CUENTAS_URL`.

## Pasos (Railway u otro host con Docker)

1. Crear Postgres con pgvector y Redis.
2. Desplegar la API con las variables; `DB_MIGRATIONS_RUN=true` aplica las migraciones al arrancar.
3. Desplegar la web con los `NEXT_PUBLIC_*` como build args.
4. En Meta: webhook `https://<api>/webhooks/whatsapp` con el token de verificación; suscribir `messages`.
5. En Cuentas: registrar ARM como app y activar `arm` en `TenantApp` para cada empresa.
6. Verificar `GET /health` y un mensaje de prueba de punta a punta.

## Operación

- **Varias instancias de API** funcionan con Redis: el tiempo real va por Redis pub/sub, el límite de peticiones se cuenta en Redis y el barrido es un job programado de BullMQ (corre una sola vez por minuto). Sin `REDIS_URL` todo queda en memoria y solo vale una instancia.
- **Logs**: el logger de Nest a stdout; el proveedor los recolecta. Buscar `Barrido`, `Agente falló` y `No se guardaron` para incidentes.
- **Respaldo**: ver `DATABASE.md`.
- **CI**: `.github/workflows/ci.yml` corre lint, tipos, pruebas unitarias y e2e de la API y lint, tipos, pruebas y build de la web.
