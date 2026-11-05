# ARM

CRM con IA de la suite (Cuentas + ARP + ARM). Diseño: `docs/superpowers/specs/2026-11-05-arm-fase-1-design.md`.

| Carpeta | Qué es |
|---|---|
| `api/` | Backend NestJS 10 + TypeORM + Postgres (pgvector) |
| `web/` | Frontend Next.js |

Desarrollo local:

```bash
docker compose up -d          # Postgres :5434 (bases arm y arm_test) y Redis :6380
cd api && cp .env.example .env && npm i
npm run migration:run && npm run start:dev   # :3002 (PuntoVenta/Cuentas corre en :3001)
# En Railway: DB_MIGRATIONS_RUN=true aplica las migraciones al arrancar.
npm test && npm run test:e2e
cd ../web && cp .env.example .env.local && npm i && npm run dev   # :3100
```

Puertos locales: API de PuntoVenta/Cuentas `:3001` (necesita `TokenManagement:RsaPrivateKeyPem` en user-secrets; sin eso ARM rechaza el token), frontend de PuntoVenta `:3000`, API de ARM `:3002`, web de ARM `:3100`.
