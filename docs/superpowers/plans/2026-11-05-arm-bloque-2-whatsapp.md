# ARM Bloque 2: canal WhatsApp y bandeja. Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que una empresa conecte su WhatsApp de ventas a ARM, que los mensajes de sus clientes aparezcan en una bandeja en tiempo real y que un miembro pueda responderles desde ARM. Este bloque no incluye IA.

**Architecture:**
- **Módulo `canales`:** es la frontera con Meta. Contiene conexión, cliente de la Graph API, webhook y envío, y está pensado para poder extraerse después como servicio de Mensajería de la suite.
- **Módulo `bandeja`:** contactos, conversaciones, mensajes, envío humano y eventos en tiempo real (SSE).
- **Código copiado y adaptado** de `D:\Github\wuarikes\huarique_backend\src`:
  - `modules/whatsapp/meta-webhook.util.ts`
  - `modules/whatsapp/meta-connect.service.ts`
  - `common/utils/encryption-transformer.ts`
  - el SSE de `modules/whatsapp/conversations.controller.ts`
  - `warike_administrativo/apps/dashboard/components/FacebookWhatsAppConnect.tsx`

**Tech Stack:** el mismo del bloque 1 (NestJS 10, TypeORM, jest, Next 15) más `fetch` nativo para la Graph API, sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-11-05-arm-fase-1-design.md`. Secciones: Restricciones (App de Meta, Estado de los números piloto, Número único) y Cómo funciona (Conexión del canal, Recepción de un mensaje).

## Global Constraints

- **Meta.**
  - Se usa la **app de Meta de Wuarikes** (`META_APP_ID`, `META_APP_SECRET` y `META_EMBEDDED_SIGNUP_CONFIG_ID`, los mismos valores que en Wuarikes) con `WHATSAPP_API_VERSION` (por defecto `v20.0`).
  - **ARM nunca modifica `huarique_backend`.**
- **Redirección de mensajes por número.** Al conectar se ejecuta `POST /{phone_number_id}` con `{ webhook_configuration: { override_callback_uri: ARM_PUBLIC_URL + '/webhooks/whatsapp', verify_token: WHATSAPP_WEBHOOK_VERIFY_TOKEN } }`.
  - Si Meta lo rechaza y la cuenta (WABA) tiene **un solo** número, se usa la redirección de cuenta: `POST /{waba_id}/subscribed_apps` con `{ override_callback_uri, verify_token }`.
  - Si la cuenta tiene más números, se responde 409 con el mensaje `Este número comparte cuenta de WhatsApp Business con otros números; conéctalo desde una cuenta propia` y no se guarda nada.
- **Número único:** `phone_number_id` es UNIQUE en todo ARM. Si ya está conectado en otra empresa → 409 `Este número de WhatsApp ya está conectado a otra empresa`, y no se toca la fila existente.
- **Tokens:** los de Meta se guardan cifrados con AES-256-GCM (`FIELD_ENCRYPTION_KEY`, transformer copiado de Wuarikes) y nunca salen en una respuesta de la API.
- **Webhook:**
  - Valida `X-Hub-Signature-256` sobre el cuerpo crudo con `META_APP_SECRET` (Nest con `rawBody: true`). Sin firma válida → 401. Sin `META_APP_SECRET` → 500.
  - Responde 200 de inmediato y procesa después.
  - Es idempotente por id de mensaje de Meta (`wa_message_id` UNIQUE).
- **Ventana de 24 h:** un texto libre solo se envía si el último mensaje **entrante** de la conversación tiene menos de 24 h. Si no, responde 409 `{ code: 'FUERA_DE_VENTANA' }` sin llamar a Meta. Las plantillas llegan en el bloque 6.
- **Separación por empresa:** todo lo de la bandeja se filtra por `tenant`, y los eventos SSE solo llegan a miembros de la misma empresa.
- **Permisos:**
  - Conectar números: solo `gerente`.
  - Ver la bandeja y responder: cualquier miembro activo. La restricción "comercial ve solo sus leads" llega en el bloque 4.

## Review Focus

1. **Webhook sin firma o con firma inválida:** 401 y no se guarda nada. Lo prueba `firma inválida → 401 sin efectos` (Task 2).
2. **Meta reenvía el mismo mensaje** (reintentos): se guarda una sola vez y no emite dos eventos. Lo prueba `mensaje duplicado se guarda una vez` (Task 2).
3. **Mensaje para un número de otra empresa o desconocido:** solo lo ve la empresa dueña del número; uno desconocido se ignora. Lo prueban `número desconocido se ignora` (Task 2) y `SSE no cruza empresas` (Task 3).
4. **Conectar un número que ya tiene otra empresa:** 409 y el token de la otra empresa sigue intacto. Lo prueba `número de otra empresa → 409 sin tocarlo` (Task 1).
5. **Meta falla a mitad de la conexión:** no queda un número guardado a medias. Lo prueba `falla de Meta no guarda nada` (Task 1).

---

### Task 1: Conexión del número (módulo `canales`)

**Files:**
- Create: `api/src/common/encryption.transformer.ts` (copiado de `huarique_backend/src/common/utils/encryption-transformer.ts`)
- Create: `api/src/canales/numero-whatsapp.entity.ts`, `meta-graph.client.ts`, `conexion-whatsapp.service.ts`, `canales.controller.ts`, `canales.module.ts`, `dto/conectar.dto.ts`
- Create: migración `<ts>-NumerosWhatsapp.ts`
- Modify: `api/src/app.module.ts`, `api/.env.example` (agregar `META_APP_ID`, `META_APP_SECRET`, `META_EMBEDDED_SIGNUP_CONFIG_ID`, `WHATSAPP_API_VERSION`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `ARM_PUBLIC_URL`, `FIELD_ENCRYPTION_KEY`)
- Test: `api/src/canales/conexion-whatsapp.service.spec.ts`

**Interfaces:**
- Produces:
  - Entidad `NumeroWhatsapp` (tabla `numeros_whatsapp`):

    | Campo | Tipo |
    |---|---|
    | `id` | uuid |
    | `tenant` | |
    | `phoneNumberId` | varchar 50, **UNIQUE** |
    | `wabaId` | varchar 50 |
    | `telefono` | varchar 20, solo dígitos |
    | `nombreVerificado` | varchar 200, null |
    | `token` | text, cifrado |
    | `coexistencia` | bool |
    | `activo` | bool, por defecto `true` |
    | `createdAt` | |
  - `class MetaGraph { llamar<T>(metodo: 'GET'|'POST', ruta: string, opts?: { token?: string; body?: unknown; query?: Record<string,string> }): Promise<T> }`:
    - Usa `fetch` contra `https://graph.facebook.com/${WHATSAPP_API_VERSION}`, con un timeout de 20 s (`AbortSignal.timeout`).
    - Ante un error de Meta lanza `MetaError extends BadGatewayException` con el mensaje `Meta respondió con error: <error.message>`.
    - Es inyectable para reemplazarlo en las pruebas.
  - `ConexionWhatsappService.conectar(tenant, dto: { code: string; wabaId: string; phoneNumberId?: string; coexistencia?: boolean }): Promise<NumeroPublico>`. Pasos, en orden (adaptados de `MetaConnectService.complete`):
    1. Si viene `phoneNumberId`, verifica que esté libre.
    2. Canjea el código: `GET /oauth/access_token` con `client_id`, `client_secret` y `code`.
    3. Obtiene el número: si no vino `phoneNumberId`, toma el primero de `GET /{waba}/phone_numbers`; luego verifica que esté libre.
    4. Suscribe la app: `POST /{waba}/subscribed_apps`.
    5. Si no es coexistencia, registra el número: `POST /{phone}/register` con un PIN aleatorio. Un error aquí se ignora.
    6. Configura la redirección según Global Constraints.
    7. Obtiene los datos del número: `GET /{phone}?fields=display_phone_number,verified_name`.
    8. **Recién entonces** guarda el número (crea uno nuevo o actualiza el de la misma empresa).
  - `ConexionWhatsappService.conectarExistente(tenant, dto: { phoneNumberId: string; wabaId: string; token: string }): Promise<NumeroPublico>`: los mismos pasos 3, 4, 6, 7 y 8, sin canje de código ni registro.
  - `ConexionWhatsappService.listar(tenant): Promise<NumeroPublico[]>`.
  - `ConexionWhatsappService.porPhoneNumberId(id): Promise<NumeroWhatsapp | null>`. Solo lo usan el webhook y el envío.
  - `type NumeroPublico = { id; telefono; nombreVerificado; coexistencia; activo }`, sin token.
  - Endpoints:
    - `GET /canales/whatsapp/config` → `{ configurado, appId, configId, graphVersion }`.
    - `GET /canales` (miembro activo).
    - `POST /canales/whatsapp/conectar` (gerente).
    - `POST /canales/whatsapp/conectar-existente` (gerente).

- [ ] **Step 1: Tests que fallan** en `conexion-whatsapp.service.spec.ts`. Contra `arm_test`, con un `MetaGraph` falso que registra las llamadas y responde según la ruta:
  - `conecta con código: canjea, suscribe, registra, redirige por número y guarda`. Comprueba el orden de las rutas llamadas, que `body.webhook_configuration.override_callback_uri` sea `${ARM_PUBLIC_URL}/webhooks/whatsapp` y que el token quede cifrado en la base (la columna cruda no contiene el token).
  - `coexistencia no llama a register`.
  - `sin phoneNumberId toma el primero de la cuenta`.
  - `redirección por número rechazada y cuenta con un número → redirige la cuenta`. La llamada a `subscribed_apps` debe llevar `override_callback_uri`.
  - `redirección por número rechazada y cuenta con varios números → 409 sin guardar`.
  - `número de otra empresa → 409 sin tocarlo`. La fila y el token de la otra empresa siguen iguales y no se llamó a `/oauth/access_token`.
  - `falla de Meta no guarda nada`. Si `subscribed_apps` lanza `MetaError`, la tabla queda vacía.
  - `reconectar el mismo número en la misma empresa actualiza el token`.
  - `listar no expone el token`.
- [ ] **Step 2:** `npm test -- conexion-whatsapp`. Expected: FAIL.
- [ ] **Step 3: Implementar** según las Interfaces. El controlador usa `@Roles('gerente')` en los dos POST.
- [ ] **Step 4:** `npm test -- conexion-whatsapp`. Expected: PASS.
- [ ] **Step 5:** `npm test && npm run test:e2e`. Expected: PASS (no rompe el bloque 1).
- [ ] **Step 6: Commit.** `git commit -am "feat(canales): conectar WhatsApp con redirección del webhook por número"`

### Task 2: Webhook de WhatsApp y registro de mensajes entrantes

**Files:**
- Create: `api/src/canales/meta-webhook.util.ts` (copiado de Wuarikes y ampliado), `api/src/canales/webhook.controller.ts`
- Create: `api/src/bandeja/contacto.entity.ts`, `conversacion.entity.ts`, `mensaje.entity.ts`, `entrantes.service.ts`, `eventos.service.ts`, `bandeja.module.ts`
- Create: migración `<ts>-Bandeja.ts`
- Modify: `api/src/main.ts` y `test/util/app.ts` (`rawBody: true`)
- Test: `api/src/canales/meta-webhook.util.spec.ts`, `api/src/bandeja/entrantes.service.spec.ts`, `api/test/webhook.e2e-spec.ts`

**Interfaces:**
- Consumes: `NumeroWhatsapp` y `porPhoneNumberId` (Task 1).
- Produces:
  - `parseMetaWebhook(payload): Entrante[]`:
    - `Entrante = { phoneNumberId; from; nombre; waMessageId; tipo; texto: string | null; mediaId: string | null; mimeType: string | null; referral: Referral | null; timestamp: Date }`.
    - `texto` sale de `text.body`, `button.text`, `interactive.*.title` o del `caption` del media.
    - `Referral = { sourceId: string | null; sourceType: string | null; sourceUrl: string | null; headline: string | null }`, tomado de `msg.referral` (anuncios que llevan a WhatsApp).
  - `parseMessageEchoes(payload): Eco[]`, copiado tal cual de Wuarikes.
  - Entidades:

    | Entidad (tabla) | Campos | Restricciones |
    |---|---|---|
    | `Contacto` (`contactos`) | `id`, `tenant`, `telefono` (varchar 20), `nombre`, `createdAt` | UNIQUE(`tenant`, `telefono`) |
    | `Conversacion` (`conversaciones`) | `id`, `tenant`, `numeroId` (FK), `contactoId` (FK), `modo: 'ia'\|'humano'` (por defecto `'ia'`), `ultimoMensajeEn`, `ultimoEntranteEn` (null), `noLeidos` (int, por defecto 0) | UNIQUE(`numeroId`, `contactoId`) |
    | `Mensaje` (`mensajes`) | `id`, `tenant`, `conversacionId` (FK), `direccion: 'entrante'\|'saliente'`, `origen: 'cliente'\|'humano'\|'app_celular'\|'ia'`, `tipo` (varchar 20), `texto` (text, null), `mediaId` (null), `mimeType` (null), `waMessageId` (varchar 100, null), `referral` (jsonb, null), `autorMiembroId` (null), `createdAt` | `waMessageId` UNIQUE |

    `origen: 'ia'` se usa desde el bloque 3.
  - `EventosService`:
    - `emitir(tenant: string, evento: EventoBandeja): void`.
    - `deEmpresa(tenant: string): Observable<EventoBandeja>`, con un `Subject` de rxjs filtrado por empresa.
    - `EventoBandeja = { tipo: 'mensaje'; conversacionId: string; mensaje: Mensaje }`.
    - Lleva el comentario `ponytail: en memoria, un solo proceso; Redis pub/sub si ARM corre en más de una instancia`.
  - `EntrantesService.procesar(payload): Promise<void>`. Por cada entrante:
    1. Busca el número activo. Si no existe, registra un warning y lo ignora.
    2. Hace upsert del contacto (actualiza el nombre de perfil).
    3. Hace upsert de la conversación.
    4. Inserta el mensaje (`entrante`, `cliente`). Si el `waMessageId` ya existe, termina sin emitir.
    5. Actualiza `ultimoMensajeEn` y `ultimoEntranteEn` y suma 1 a `noLeidos`.
    6. Emite el evento.

    Por cada eco: lo guarda como `saliente`, origen `app_celular`, y pasa la conversación a `modo = 'humano'`.
  - `WebhookController`:
    - `GET /webhooks/whatsapp`: verificación con `WHATSAPP_WEBHOOK_VERIFY_TOKEN`; devuelve `hub.challenge`, o 403.
    - `POST /webhooks/whatsapp`: firma, luego 200, luego `procesar` sin esperar (los errores se registran con `Logger`).
    - Ambos `@Public()`.

- [ ] **Step 1: Tests que fallan:**
  - `meta-webhook.util.spec.ts`:
    - texto;
    - botón;
    - imagen con caption (`tipo: 'image'`, `texto` igual al caption, `mediaId`);
    - audio sin texto (`texto: null`, `mediaId`);
    - referral de anuncio con los 4 campos;
    - entrega de estados (`statuses`) → `[]`;
    - eco de coexistencia.
  - `entrantes.service.spec.ts` (contra `arm_test`):
    - `crea contacto, conversación y mensaje y emite evento`;
    - `mensaje duplicado se guarda una vez` (mismo payload dos veces → 1 mensaje, 1 evento, `noLeidos = 1`);
    - `número desconocido se ignora` (0 filas, 0 eventos);
    - `dos números de empresas distintas no se mezclan`;
    - `eco pasa la conversación a humano`;
    - `guarda el referral del anuncio`.
  - `test/webhook.e2e-spec.ts`:
    - `GET verifica con el token correcto y 403 con otro`;
    - `firma inválida → 401 sin efectos`;
    - `firma válida → 200 y el mensaje queda guardado`. Se firma con `META_APP_SECRET` de prueba y el mensaje se espera con un sondeo de hasta 2 s.
- [ ] **Step 2:** `npm test -- webhook entrantes && npm run test:e2e -- webhook`. Expected: FAIL.
- [ ] **Step 3: Implementar.** `NestFactory.create(AppModule, { rawBody: true })`, y lo mismo en `crearApp`.
- [ ] **Step 4:** las mismas pruebas del Step 2. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(canales): webhook de WhatsApp con firma, idempotencia y registro en la bandeja"`

### Task 3: API de la bandeja, respuesta humana y tiempo real

**Files:**
- Create: `api/src/bandeja/bandeja.service.ts`, `bandeja.controller.ts`, `dto/enviar-mensaje.dto.ts`
- Create: `api/src/canales/envio-whatsapp.service.ts`
- Create: `api/src/auth/token-en-query.decorator.ts`
- Modify: `api/src/auth/suite-auth.guard.ts` (en las rutas `@TokenEnQuery()` acepta `?token=` si no hay cabecera)
- Test: `api/src/bandeja/bandeja.service.spec.ts`, `api/src/auth/suite-auth.guard.spec.ts` (caso nuevo), `api/test/bandeja.e2e-spec.ts`

**Interfaces:**
- Consumes: entidades, `EventosService` (Task 2), `MetaGraph` y `NumeroWhatsapp` (Task 1), `@MiembroActual` (bloque 1).
- Produces:
  - `EnvioWhatsappService.enviarTexto(numero: NumeroWhatsapp, a: string, texto: string): Promise<string>`. Hace `POST /{phoneNumberId}/messages` con `{ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body, preview_url: false } }` y devuelve el `wamid`.
  - `BandejaService`:
    - `listar(tenant): Promise<ConversacionResumen[]>`, ordenado por `ultimoMensajeEn` descendente. `ConversacionResumen = { id, contacto: { id, nombre, telefono }, modo, noLeidos, ultimoMensajeEn, ultimoTexto }`.
    - `mensajes(tenant, conversacionId): Promise<Mensaje[]>`, en orden ascendente. Pone `noLeidos = 0`. Si la conversación es de otra empresa → 404.
    - `responder(tenant, conversacionId, miembro: Miembro, texto: string): Promise<Mensaje>`:
      - Valida la ventana de 24 h según Global Constraints.
      - Envía, guarda el mensaje (`saliente`, `humano`, `autorMiembroId`, `waMessageId`), pasa la conversación a `modo = 'humano'`, actualiza `ultimoMensajeEn` y emite el evento.
      - Si Meta falla → 502 con su mensaje, y no se guarda nada.
  - Endpoints (miembro activo):
    - `GET /conversaciones`.
    - `GET /conversaciones/:id/mensajes`.
    - `POST /conversaciones/:id/mensajes` con `{ texto: string 1..4096 }`.
    - `GET /eventos` (`@Sse`, `@TokenEnQuery`, `@PermitirPendiente` **no**): flujo de `EventosService.deEmpresa(miembro.tenant)`.

- [ ] **Step 1: Tests que fallan:**
  - `bandeja.service.spec.ts`:
    - `listar ordena por último mensaje y no cruza empresas`;
    - `mensajes pone noLeidos en 0`;
    - `responder dentro de 24 h envía, guarda y pasa a humano`;
    - `responder fuera de la ventana → 409 FUERA_DE_VENTANA sin llamar a Meta`;
    - `responder sin ningún entrante → 409 FUERA_DE_VENTANA`;
    - `falla de Meta → 502 sin guardar`;
    - `conversación de otra empresa → 404`.
  - `suite-auth.guard.spec.ts`:
    - `token en query solo en rutas @TokenEnQuery`;
    - el mismo token en query en una ruta normal → 401.
  - `bandeja.e2e-spec.ts`:
    - `SSE no cruza empresas`: dos clientes SSE de empresas distintas; un entrante para la empresa A llega solo al cliente A.
- [ ] **Step 2:** `npm test -- bandeja suite-auth && npm run test:e2e -- bandeja`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** `npm test && npm run test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(bandeja): conversaciones, respuesta humana con ventana de 24 h y eventos SSE"`

### Task 4: Web: Canales y Bandeja

**Files:**
- Create: `web/src/components/ConectarWhatsapp.tsx` (adaptado de `warike_administrativo/apps/dashboard/components/FacebookWhatsAppConnect.tsx`: SDK de Facebook, `FB.login` con `config_id`, `response_type: 'code'`, `override_default_response_type: true` y `extras: { setup: {}, featureType: coexistencia ? 'whatsapp_business_app_onboarding' : '', sessionInfoVersion: '3' }`; escucha `message` de `WA_EMBEDDED_SIGNUP` con `FINISH` o `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`)
- Create: `web/src/app/(app)/canales/page.tsx`, `web/src/app/(app)/bandeja/page.tsx`, `web/src/lib/bandeja.ts`
- Modify: `web/src/app/(app)/layout.tsx` (enlaces Bandeja y Canales), `web/src/lib/sesion.ts` (`destinoTrasMe`: miembro activo → `/bandeja`)
- Test: `web/src/lib/bandeja.test.ts`, `web/src/lib/sesion.test.ts` (actualizar)

**Interfaces:**
- Consumes: los endpoints de las Tasks 1 y 3.
- Produces: en `web/src/lib/bandeja.ts`:
  - `aplicarEvento(lista: ConversacionResumen[], ev: EventoBandeja, abiertaId: string | null): ConversacionResumen[]`: sube la conversación al principio, actualiza `ultimoTexto` y `ultimoMensajeEn`, y suma 1 a `noLeidos` solo si no está abierta y el mensaje es entrante. Si la conversación no está en la lista, la agrega.
  - `fueraDeVentana(ultimoEntranteEn: string | null, ahora: Date): boolean`.

- [ ] **Step 1: Tests que fallan:**
  - `bandeja.test.ts`:
    - `evento sube la conversación y suma no leídos`;
    - `evento de la conversación abierta no suma no leídos`;
    - `evento de conversación nueva la agrega`;
    - `fueraDeVentana` con 23 h → false, con 25 h → true y con null → true.
  - `sesion.test.ts`: gerente y comercial activos → `/bandeja`.
- [ ] **Step 2:** `npx vitest run`. Expected: FAIL.
- [ ] **Step 3: Implementar.**
  - **Canales (gerente):**
    - Lista de números conectados.
    - Botón "Conectar WhatsApp" con dos opciones: número nuevo o "Ya uso WhatsApp Business en el celular" (coexistencia).
    - Formulario plegable "Conectar número existente" (phoneNumberId, wabaId, token).
    - Si `config.configurado` es false: `La conexión con Facebook no está configurada en el servidor`.
  - **Bandeja:**
    - Lista a la izquierda con nombre, último texto, no leídos e indicador IA/Humano.
    - Chat a la derecha. Los mensajes se ven distintos según sean del cliente, de un humano o de la app del celular.
    - Caja de texto para responder.
    - `EventSource(`${API}/eventos?token=…`)` aplicando `aplicarEvento`.
    - Si `fueraDeVentana`, la caja se deshabilita con el texto `Pasaron más de 24 h desde el último mensaje del cliente. Podrás escribirle con plantillas (próximamente).`
    - Los tipos sin texto muestran `[imagen]`, `[audio]`, etc.
  - En móvil, la lista y el chat se alternan.
- [ ] **Step 4:** `npx vitest run && npm run lint && npm run build`. Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(web): canales con Embedded Signup y bandeja en tiempo real"`

## Verificación con un número real (la hace el usuario; no es parte del contrato de las tareas)

1. **ARM accesible por HTTPS público** (Railway o un túnel) y `ARM_PUBLIC_URL` apuntando ahí.
2. **En la app de Meta de Wuarikes:** agregar el dominio de la web de ARM en "Dominios permitidos para el SDK de JavaScript" y en los dominios de la app.
3. **Conectar el número de ventas de prueba desde Canales** y escribirle desde otro celular:
   - el mensaje debe aparecer en la Bandeja **y no en Wuarikes**;
   - responder desde ARM debe llegar al celular.
4. **Si Meta rechaza la redirección por número**, ARM lo dirá al conectar. En ese caso hay que usar una cuenta de WhatsApp Business propia para ese número.

## Fuera de este bloque

- IA, cola y transcripción: bloque 3.
- Descarga y visualización de imágenes y audios: con el bloque 3.
- Plantillas: bloque 6.
- Estados de entrega (doble check), desconexión desde el celular (`PARTNER_REMOVED`) y consumo o costo de mensajes: más adelante.
