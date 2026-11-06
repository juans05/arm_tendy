# ARM

CRM con IA de la suite (Cuentas + ARP + ARM). Atiende el WhatsApp de ventas, califica leads con IA, agenda demos y da al equipo un embudo, un calendario y un panel. Diseño: `docs/superpowers/specs/2026-11-05-arm-fase-1-design.md`.

| Carpeta | Qué es |
|---|---|
| `api/` | Backend NestJS 10 + TypeORM + Postgres (pgvector) + Redis (BullMQ) |
| `web/` | Frontend Next.js 15 (PWA) |

Desarrollo local:

```bash
docker compose up -d          # Postgres :5434 (bases arm y arm_test) y Redis :6380
cd api && cp .env.example .env && npm i
npm run migration:run && npm run start:dev   # :3002 (PuntoVenta/Cuentas corre en :3001)
# En Railway: DB_MIGRATIONS_RUN=true aplica las migraciones al arrancar.
npm test && npm run test:e2e                  # en serie: comparten la base arm_test
cd ../web && cp .env.example .env.local && npm i && npm run dev   # :3100
```

Puertos locales: API de PuntoVenta/Cuentas `:3001` (necesita `TokenManagement:RsaPrivateKeyPem` en user-secrets; sin eso ARM rechaza el token), frontend de PuntoVenta `:3000`, API de ARM `:3002`, web de ARM `:3100`. No correr `npm run build` de la web con `npm run dev` encendido: comparten `.next`.

Datos de demostración (solo local): `cd api && npx ts-node --transpile-only scripts/vitrina.ts <carpeta>` crea la empresa "vitrina", sirve un JWKS en `:4999` y deja tokens de gerente y comercial en `<carpeta>/vitrina-tokens.json`. Arranca la API con `CUENTAS_URL=http://localhost:4999 BARRIDO=off` y guarda el token en `localStorage.arm_token`.

## Documentación

[Arquitectura](docs/ARCHITECTURE.md) · [Base de datos](docs/DATABASE.md) · [API](docs/API.md) · [IA](docs/AI_ARCHITECTURE.md) · [Seguridad](docs/SECURITY.md) · [Despliegue](docs/DEPLOYMENT.md) · [Hoja de ruta](docs/ROADMAP.md) · [Frente a Twenty](docs/COMPARATIVA_TWENTY.md) · [Frente a Salesforce](docs/COMPARATIVA_SALESFORCE.md) · [Cambios](CHANGELOG.md)
