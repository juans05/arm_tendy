# ARM Bloque 1: Base, login de la suite, miembros y líneas de producto. Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un usuario de PuntoVenta de una empresa con `arm` contratado entre a ARM con su login de siempre, quede registrado como miembro (el primero es gerente) y que el gerente administre miembros y líneas de producto.

**Architecture:** Repositorio nuevo `D:\Github\arm` con dos carpetas independientes:
- `api/`: NestJS 10 + TypeORM 0.3 + Postgres con pgvector.
- `web/`: Next.js App Router.

ARM no tiene usuarios ni contraseñas propios. La API valida el JWT RS256 de PuntoVenta contra su JWKS. Toda tabla lleva `tenant` (el claim de empresa) y toda consulta filtra por él.

**Tech Stack:** NestJS 10, TypeORM 0.3, pg, `jose` (JWKS + verificación), jest 29, supertest, Docker Compose (`pgvector/pgvector:pg16`, `redis:7`), Next.js 15 + React 19 + TypeScript.

**Spec:** `docs/superpowers/specs/2026-11-05-arm-fase-1-design.md` (en el repo PuntoVenta)

## Global Constraints

- **Versiones:** NestJS 10 y TypeORM 0.3, las mismas que `D:\Github\wuarikes\huarique_backend`, para que los módulos que se copien en los bloques 2–7 compilen sin migrar.
- **Token:**
  - Se acepta solo **RS256** verificado contra `${CUENTAS_URL}/.well-known/jwks.json`, con `iss` = `CUENTAS_ISSUER` y `aud` = `CUENTAS_AUDIENCE`. Hoy en PuntoVenta valen `https://wsp-sms-api.initchange.dev` y `https://wsp-sms.initchange.dev`.
  - Cualquier otro algoritmo (por ejemplo HS256) se rechaza.
- **Claims de PuntoVenta** (exactos):
  - Usuario: `nameid`.
  - Usuario visible: `username`.
  - Nombre: `nombre`.
  - Empresa: `https://schemas.microsoft.com/identity/claims/tenantid`, con el valor `Tenant.Name`, que es la clave de empresa en ARM.
  - Apps: `apps`, un **string** con un arreglo JSON, por ejemplo `"[\"arp\",\"arm\"]"`.
- **Acceso:** sin `arm` en `apps` → 403 con cuerpo `{ "code": "SIN_ARM" }`. Token inválido o vencido → 401.
- **Separación por empresa:** toda entidad tiene la columna `tenant` (varchar 200) y todo acceso por id filtra también por `tenant`. Si el id pertenece a otra empresa, se responde 404, no 403.
- **Interfaz y mensajes:** en español. Zona horaria `America/Lima`.
- **Migraciones:** TypeORM con `synchronize: false` siempre. La primera migración ejecuta `CREATE EXTENSION IF NOT EXISTS vector`.
- **Errores de la API:** las excepciones de Nest se responden con `{ statusCode, code?, message }`.

## Review Focus

1. **Dos usuarios nuevos de la misma empresa entran a la vez a una empresa sin miembros:** debe quedar **un solo** gerente. Lo prueba `primer miembro concurrente: un solo gerente` (Task 3).
2. **Token HS256 firmado con la clave HMAC de PuntoVenta**, que hoy sigue vigente en producción: debe dar 401. Si se aceptara, cualquiera con esa clave entraría. Lo prueba `rechaza HS256` (Task 2).
3. **Claim `apps` ausente, vacío o con JSON inválido:** debe dar 403 `SIN_ARM`, no 500. Lo prueba `apps mal formado → SIN_ARM` (Task 2).
4. **El gerente se quita su propio rol o se desactiva siendo el único gerente activo:** debe rechazarse con 400, porque la empresa quedaría sin nadie que administre. Lo prueba `no deja sin gerente activo` (Task 3).
5. **Un gerente de la empresa A intenta editar un miembro o una línea de la empresa B por id:** debe dar 404. Lo prueban `aislamiento entre empresas` (Tasks 3 y 4).

---

### Task 1: Esqueleto del repo, base de datos y salud

**Files:**
- Create: `D:\Github\arm\.gitignore`, `D:\Github\arm\README.md`, `D:\Github\arm\docker-compose.yml`
- Create: `api/` (Nest CLI: `package.json`, `tsconfig.json`, `nest-cli.json`, `src/main.ts`, `src/app.module.ts`)
- Create: `api/src/config/database.config.ts`, `api/src/config/data-source.ts`
- Create: `api/src/database/migrations/<ts>-Inicial.ts`
- Create: `api/src/health/health.controller.ts`
- Create: `api/.env.example`
- Test: `api/test/health.e2e-spec.ts`, `api/test/jest-e2e.json`

**Interfaces:**
- Produces:
  - `GET /health` → `200 { ok: true, db: true }`.
  - `DatabaseConfig`: `TypeOrmOptionsFactory` que lee `DATABASE_URL`, carga `**/*.entity{.ts,.js}`, migraciones en `database/migrations` y `synchronize: false`.
  - `data-source.ts`: `DataSource` para la CLI (`npm run migration:run` / `migration:generate`).
  - Helper de e2e `test/util/app.ts`: `crearApp(overrides?): Promise<INestApplication>`, que levanta el `AppModule` contra `DATABASE_URL_TEST`, corre las migraciones y limpia las tablas.

- [ ] **Step 1:** `git init D:\Github\arm`.
  - `docker-compose.yml` levanta:
    - `pgvector/pgvector:pg16` en el puerto 5434, con las bases `arm` y `arm_test`,
    - `redis:7` en el puerto 6380.
  - `nest new api --skip-git --package-manager npm`.
  - Fijar `@nestjs/*` a `^10` y agregar `@nestjs/typeorm@^10`, `typeorm@^0.3.19`, `pg`, `@nestjs/config`.
  - `.env.example`: `DATABASE_URL`, `DATABASE_URL_TEST`, `REDIS_URL`, `CUENTAS_URL`, `CUENTAS_ISSUER`, `CUENTAS_AUDIENCE`, `WEB_ORIGIN`.
- [ ] **Step 2: Test que falla.** `test/health.e2e-spec.ts`: `GET /health` responde 200 con `{ ok: true, db: true }`.
- [ ] **Step 3:** `docker compose up -d` y `npm run test:e2e -- health`. Expected: FAIL (404 o el módulo no existe).
- [ ] **Step 4: Implementar.**
  - `DatabaseConfig` (patrón de `huarique_backend/src/config/database.config.ts`, sin `schema`).
  - Migración `Inicial` con `CREATE EXTENSION IF NOT EXISTS vector`.
  - `HealthController` hace `SELECT 1` con `DataSource`.
  - CORS habilitado para `WEB_ORIGIN`.
  - `crearApp` en `test/util/app.ts`.
- [ ] **Step 5:** `npm run test:e2e -- health`. Expected: PASS.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "chore: esqueleto ARM api con Postgres pgvector y salud"`

### Task 2: Autenticación con el token de la suite

**Files:**
- Create: `api/src/auth/suite-user.ts`, `api/src/auth/jwks.provider.ts`, `api/src/auth/suite-auth.guard.ts`, `api/src/auth/public.decorator.ts`, `api/src/auth/current-user.decorator.ts`, `api/src/auth/auth.module.ts`
- Test: `api/src/auth/suite-auth.guard.spec.ts`

**Interfaces:**
- Produces:
  - `interface SuiteUser { userId: string; username: string; nombre: string; tenant: string; apps: string[] }`
  - `JWKS_KEY_SET`: token de inyección cuyo valor es `JWTVerifyGetKey`. En producción es `createRemoteJWKSet(new URL(`${CUENTAS_URL}/.well-known/jwks.json`))`. En las pruebas es `createLocalJWKSet({ keys: [jwkPublica] })`.
  - `SuiteAuthGuard`: guard **global** (APP_GUARD) que lee `Authorization: Bearer`, llama a `jwtVerify(token, keySet, { algorithms: ['RS256'], issuer, audience })` y deja el resultado en `req.user: SuiteUser`.
  - `@Public()` salta el guard (lo usa `/health`).
  - `@CurrentUser()` devuelve `SuiteUser`.
  - Exporta `function parseApps(raw: unknown): string[]`, que acepta un string con un arreglo JSON o un arreglo. Ante cualquier otra cosa devuelve `[]`.

- [ ] **Step 1: Tests que fallan** en `suite-auth.guard.spec.ts`. Generar el par RSA en la prueba con `generateKeyPair('RS256')` de `jose` y firmar con `SignJWT`. Casos:
  - `acepta RS256 válido con arm`: `req.user` igual a `{ userId: 'u1', username: 'JUAN', nombre: 'Juan', tenant: 'wuarikes', apps: ['arp','arm'] }`, con claims `nameid: 'u1'`, `username: 'JUAN'`, `nombre: 'Juan'`, `'https://schemas.microsoft.com/identity/claims/tenantid': 'wuarikes'` y `apps: '["arp","arm"]'`.
  - `rechaza HS256`: token firmado HS256 con secreto → `UnauthorizedException`.
  - `rechaza firma de otra clave RSA` → `UnauthorizedException`.
  - `rechaza vencido` (`exp` en el pasado) → `UnauthorizedException`.
  - `rechaza audience distinta` → `UnauthorizedException`.
  - `sin arm → SIN_ARM`: `apps: '["arp"]'` → `ForbiddenException` cuya respuesta incluye `code: 'SIN_ARM'`.
  - `apps mal formado → SIN_ARM`: con `apps` ausente, `''`, `'no-json'` y `'{"a":1}'` → `ForbiddenException` con `code: 'SIN_ARM'`.
  - `sin tenant → 401`.
  - `@Public pasa sin token`.
- [ ] **Step 2:** `npm test -- suite-auth`. Expected: FAIL (el módulo no existe).
- [ ] **Step 3: Implementar.** `npm i jose`, más el guard, `parseApps`, los decoradores y `AuthModule` (registra `APP_GUARD` y el provider `JWKS_KEY_SET`).
  - `jose` es solo ESM a partir de la v5. Si jest lo exige, fijar `jose@^4` (CommonJS); se ajusta solo esa dependencia.
- [ ] **Step 4:** `npm test -- suite-auth`. Expected: PASS (11 casos).
- [ ] **Step 5:** `npm run test:e2e -- health`. Expected: PASS (sigue siendo público).
- [ ] **Step 6: Commit.** `git commit -am "feat: autenticación con token RS256 de la suite vía JWKS"`

### Task 3: Miembros y roles

**Files:**
- Create: `api/src/miembros/miembro.entity.ts`, `miembros.service.ts`, `miembros.controller.ts`, `miembros.module.ts`, `roles.decorator.ts`, `miembro-activo.guard.ts`, `dto/actualizar-miembro.dto.ts`
- Create: migración `<ts>-Miembros.ts`
- Test: `api/src/miembros/miembros.service.spec.ts` (contra `arm_test`), `api/test/miembros.e2e-spec.ts`

**Interfaces:**
- Consumes: `SuiteUser`, `@CurrentUser()`, `JWKS_KEY_SET` (las e2e lo reemplazan con una JWKS local) (Task 2), y `crearApp` (Task 1).
- Produces:
  - Entidad `Miembro` (tabla `miembros`):

    | Campo | Tipo |
    |---|---|
    | `id` | uuid |
    | `tenant` | varchar 200 |
    | `userId` | varchar 100 |
    | `username` | varchar 100 |
    | `nombre` | varchar 200 |
    | `rol` | `'gerente' \| 'comercial'` |
    | `estado` | `'pendiente' \| 'activo' \| 'inactivo'` |
    | `celularAlertas` | varchar 20, null |
    | `recibeDemos` | bool, por defecto `false` |
    | `createdAt` | timestamp |

    Con UNIQUE(`tenant`, `userId`).
  - `MiembrosService.entrar(user: SuiteUser): Promise<Miembro>`:
    - Busca el miembro, o lo crea.
    - Al crearlo, si la empresa no tiene miembros queda `gerente`/`activo`; si tiene, queda `comercial`/`pendiente`.
    - Actualiza `nombre`/`username` desde el token.
    - Todo dentro de una transacción con `SELECT pg_advisory_xact_lock(hashtext($tenant))`.
  - `MiembrosService.listar(tenant): Promise<Miembro[]>`.
  - `MiembrosService.actualizar(tenant, id, dto: { rol?, estado?, celularAlertas?, recibeDemos? }): Promise<Miembro>`:
    - 404 si el miembro no es de la empresa.
    - 400 con el mensaje `La empresa debe tener al menos un gerente activo` si el cambio deja la empresa sin gerente activo.
  - `MiembroActivoGuard` (global, después de `SuiteAuthGuard`):
    - Carga el miembro en `req.miembro` usando `entrar`.
    - Si `estado !== 'activo'` → 403 `{ code: 'MIEMBRO_PENDIENTE' }` o `{ code: 'MIEMBRO_INACTIVO' }`.
    - Las rutas marcadas con `@PermitirPendiente()` pasan igual.
  - `@Roles('gerente')` junto con su guard: 403 si `req.miembro.rol` no está en la lista.
  - Endpoints:
    - `GET /me` (`@PermitirPendiente`) → `{ miembro, empresa: tenant }`.
    - `GET /miembros` (gerente).
    - `PATCH /miembros/:id` (gerente).

- [ ] **Step 1: Tests que fallan** en `miembros.service.spec.ts`:
  - `primer miembro es gerente activo`.
  - `segundo miembro queda comercial pendiente`.
  - `primer miembro concurrente: un solo gerente`: `Promise.all` de `entrar` para `u1` y `u2` de la misma empresa → exactamente 1 gerente.
  - `entrar de nuevo actualiza el nombre y no duplica`.
  - `no deja sin gerente activo`: el único gerente intenta pasarse a `comercial` o a `inactivo` → 400.
  - `aislamiento entre empresas`: `actualizar('B', idDeMiembroDeA, …)` → 404.
- [ ] **Step 2:** `npm test -- miembros`. Expected: FAIL.
- [ ] **Step 3: Implementar.** Entidad, migración (`npm run migration:generate`), servicio, guards, decoradores y controlador. DTO con `class-validator`: `rol` en el enum, `celularAlertas` con `/^\+?\d{9,15}$/`.
- [ ] **Step 4:** `npm test -- miembros`. Expected: PASS.
- [ ] **Step 5: e2e que falla** en `test/miembros.e2e-spec.ts`, con tokens firmados por una JWKS local inyectada:
  - Gerente → `GET /me` 200 con `rol: 'gerente'`.
  - Segundo usuario → `GET /me` 200 con `estado: 'pendiente'`, y `GET /miembros` → 403 `MIEMBRO_PENDIENTE`.
  - El gerente activa al segundo con `PATCH` → ahora `GET /miembros` le da 403 por rol (es comercial).
  - Token sin `arm` → 403 `SIN_ARM`.
- [ ] **Step 6:** `npm run test:e2e`. Expected: PASS.
- [ ] **Step 7: Commit.** `git commit -am "feat: miembros con rol gerente/comercial y alta pendiente"`

### Task 4: Líneas de producto

**Files:**
- Create: `api/src/lineas/linea-producto.entity.ts`, `lineas.service.ts`, `lineas.controller.ts`, `lineas.module.ts`, `dto/guardar-linea.dto.ts`
- Create: migración `<ts>-LineasProducto.ts`
- Test: `api/src/lineas/lineas.service.spec.ts`

**Interfaces:**
- Consumes: `Miembro`, `@Roles`, `@CurrentUser` (Task 3).
- Produces:
  - Entidad `LineaProducto` (tabla `lineas_producto`):

    | Campo | Tipo |
    |---|---|
    | `id` | uuid |
    | `tenant` | |
    | `nombre` | varchar 100 |
    | `criterios` | text, por defecto `''` |
    | `duracionDemoMin` | int, por defecto `30` |
    | `activa` | bool, por defecto `true` |
    | `comerciales` | ManyToMany a `Miembro` mediante la tabla `linea_producto_comerciales` |

    Con UNIQUE(`tenant`, `nombre`).
  - `LineasService`:
    - `listar(tenant)`.
    - `crear(tenant, dto)`.
    - `actualizar(tenant, id, dto)`.
    - `comercialesDeLinea(tenant, lineaId): Promise<Miembro[]>`: si la línea no tiene comerciales asignados, devuelve los miembros `activo` con `recibeDemos = true`. Lo usa el bloque 5.
  - DTO `GuardarLineaDto { nombre: string (1..100); criterios?: string (≤ 4000); duracionDemoMin?: int 15..180; activa?: boolean; comercialIds?: string[] }`.
  - Endpoints:
    - `GET /lineas` (cualquier miembro activo).
    - `POST /lineas` y `PATCH /lineas/:id` (gerente).

- [ ] **Step 1: Tests que fallan:**
  - `crea con duración 30 por defecto`.
  - `nombre repetido en la misma empresa → 409` con el mensaje `Ya existe una línea con ese nombre`.
  - `mismo nombre en otra empresa se permite`.
  - `comercialIds de otra empresa → 400`.
  - `comercialesDeLinea sin asignados devuelve activos que reciben demos`.
  - `aislamiento entre empresas`: `actualizar('B', idLineaDeA)` → 404.
- [ ] **Step 2:** `npm test -- lineas`. Expected: FAIL.
- [ ] **Step 3: Implementar** la entidad, la migración, el servicio y el controlador.
- [ ] **Step 4:** `npm test -- lineas`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat: líneas de producto por empresa"`

### Task 5: Web: login de la suite, elección de empresa, miembros y líneas

**Files:**
- Create: `web/` (`create-next-app` con TypeScript, App Router y Tailwind)
- Create: `web/src/lib/cuentas.ts`, `web/src/lib/api.ts`, `web/src/lib/sesion.ts`
- Create: `web/src/app/login/page.tsx`, `web/src/app/elegir-empresa/page.tsx`, `web/src/app/pendiente/page.tsx`, `web/src/app/(app)/layout.tsx`, `web/src/app/(app)/miembros/page.tsx`, `web/src/app/(app)/lineas/page.tsx`
- Create: `web/.env.example` (`NEXT_PUBLIC_CUENTAS_URL`, `NEXT_PUBLIC_API_URL`)
- Test: `web/src/lib/sesion.test.ts` (vitest)

**Interfaces:**
- Consumes: `GET /me`, `GET|PATCH /miembros`, `GET|POST|PATCH /lineas` y los códigos `SIN_ARM` / `MIEMBRO_PENDIENTE` / `MIEMBRO_INACTIVO` (Tasks 2–4).
- Consumes de PuntoVenta:
  - `POST {CUENTAS}/api/autenticacion/token` con `{ userName, password }`.
  - `GET {CUENTAS}/api/autenticacion/empresas` → `MessageResult<EmpresaAccesoDto[]>`, con campos `tenantId`, `nombre`, `activa`.
  - `POST {CUENTAS}/api/autenticacion/cambiar-empresa/{tenantId}` → `MessageResult<AuthenticationModel>`.
  - Antes de escribir `cuentas.ts`, verificar con una llamada real (o leyendo `AuthController`/`AuthenticationService`) en qué campo viene el token en cada respuesta: `token` en la raíz o en `data.token`.
- Produces: `function destinoTrasMe(r: { status: number; code?: string; rol?: string }): '/elegir-empresa' | '/pendiente' | '/login' | '/miembros' | '/lineas'`:

  | Respuesta de `/me` | Destino |
  |---|---|
  | 401 | `/login` |
  | 403 `SIN_ARM` | `/elegir-empresa` |
  | 403 `MIEMBRO_PENDIENTE` o `MIEMBRO_INACTIVO` | `/pendiente` |
  | 200 con gerente | `/miembros` |
  | 200 con comercial | `/lineas` |

- [ ] **Step 1: Test que falla.** `sesion.test.ts` cubre los 5 casos de `destinoTrasMe`.
- [ ] **Step 2:** `npx vitest run`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
  - El token se guarda en `localStorage` (`arm_token`). `api.ts` agrega `Authorization` y ante un 401 borra el token y lleva a `/login`.
  - **Login:** usuario y contraseña. Ante un error de PuntoVenta muestra su `message`.
  - **Elegir empresa:** lista las empresas del usuario. Al elegir una, llama a `cambiar-empresa`, guarda el token nuevo y reintenta `/me`. Si sigue en `SIN_ARM`, muestra `Tu empresa no tiene ARM contratado`.
  - **Pendiente:** muestra `Tu acceso está pendiente de aprobación del gerente` y un botón para salir.
  - **Miembros:** tabla con nombre, usuario, rol, estado, recibe demos y celular, editables en línea.
  - **Líneas:** lista y un formulario con nombre, criterios (textarea), duración y comerciales (multiselección de miembros activos).
- [ ] **Step 4:** `npx vitest run && npm run build`. Expected: PASS y build sin errores.
- [ ] **Step 5: Verificación manual.** Con la API (`npm run start:dev`) y PuntoVenta **local** (no la base remota):
  - entrar como gerente,
  - crear la línea "Barbería",
  - entrar con un segundo usuario → ve la pantalla de pendiente,
  - activarlo desde Miembros.
- [ ] **Step 6: Commit.** `git add -A && git commit -m "feat(web): login de la suite, elección de empresa, miembros y líneas"`

## Requisitos para la verificación manual (fuera de ARM)

PuntoVenta local debe:
- tener `TokenManagement:RsaPrivateKeyPem` configurado (si no, firma HMAC y ARM lo rechaza),
- tener `arm` activado para la empresa de prueba (`PUT /api/tenant/superadmin/{id}/apps`),
- permitir en CORS el origen de `web` (`http://localhost:3000`).
