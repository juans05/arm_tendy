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
npm run migration:run && npm run start:dev   # :3001
npm test && npm run test:e2e
```
