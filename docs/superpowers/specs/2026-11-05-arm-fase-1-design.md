# ARM Fase 1 (MVP): diseño

ARM es el CRM con IA de la suite estilo Zoho (Cuentas + ARP/PuntoVenta + ARM). Esta fase entrega el MVP para dos empresas piloto.

## Intención

Las empresas que venden por WhatsApp pierden prospectos porque nadie responde a tiempo, nadie anota y nadie hace seguimiento. ARM pone una IA en el WhatsApp de ventas de la empresa:
- responde sola en segundos con la información del negocio,
- califica al prospecto,
- agenda la demo en el calendario de un comercial,
- avisa al comercial y se aparta,
- hace seguimiento a los que todavía no están listos.

El CRM se llena solo, porque la IA registra el lead, los datos y el motivo. Así el gerente ve reportes que sí sirven.

**Pilotos.** Los dos venden software a negocios, por eso la meta de la IA es **agendar una demo**, no cerrar la venta por chat.
- **Wuarikes:** vende software para barberías, restaurantes y spas.
- **Tendy:** vende una plataforma para empresas courier (D:\Tendy_motorizados).

En Wuarikes las demos las hace el dueño (que también hace de gerente) y/o comerciales.

**Éxito.**
- Wuarikes y Tendy conectan cada uno su celular de ventas.
- Un prospecto que escribe recibe respuesta en segundos sobre ese producto y queda calificado.
- Si está interesado, tiene una demo agendada en un horario libre real y el comercial recibe la alerta con el resumen.
- El gerente lo ve en su panel con el anuncio de Meta del que vino.

## Objetivos (Fase 1)

1. **Login de la suite.** Entran los usuarios de PuntoVenta (Cuentas) de empresas cuyo token trae `arm` en el claim `apps`.
2. **Conexión de WhatsApp por empresa** con el registro guiado de Meta (Embedded Signup) y la app de Meta de Wuarikes, que ya tiene aprobados WhatsApp y campañas.
3. **Bandeja de conversaciones** en tiempo real. Un humano puede leer y responder cualquier conversación.
4. **Agente de IA** que responde solo, con base de conocimiento por empresa, calificación configurable, agenda de demos y memoria por cliente.
5. **Embudo de leads** con etapas, asignación a comerciales y traspaso IA → humano.
6. **Calendario propio de ARM** por comercial, con recordatorios.
7. **Seguimiento automático simple** para los que "todavía no" y para los que no responden.
8. **Alertas al comercial** dentro de ARM y por WhatsApp, y escalamiento al gerente.
9. **Panel del gerente** con métricas, origen por anuncio y exportación a Excel.

## No objetivos (fases siguientes)

- Instagram, Messenger y chat web.
- Sincronización con Google Calendar u Outlook, y links de Meet o Zoom automáticos.
- Pronóstico de ventas (valor × probabilidad), cuentas o empresas B2B, campañas masivas.
- Integración con ARP (precios, stock, cotización, `venta.facturada`).
- Reportes programados, preguntas en lenguaje natural sobre los datos, análisis de conversaciones ganadas y perdidas.
- App de Meta propia de ARM, servicio de Mensajería de la suite.
- Cobro de planes de ARM (los pilotos no pagan), selector de apps ARP ↔ ARM.

## Anti-objetivos (sería un fracaso aunque "funcione")

- **Que la IA invente** precios, funciones, plazos o condiciones que no están en la base de conocimiento.
- **Que la IA y un humano respondan a la vez** en la misma conversación.
- **Que se escriba** a quien pidió no ser contactado.
- **Que se mezclen datos entre empresas**, sea en la bandeja, la base de conocimiento, los reportes o los embeddings.
- **Que se rompa Wuarikes en producción.** ARM no modifica `huarique_backend`, ni su webhook, ni sus números.
- **Que se rompa el login de PuntoVenta en producción.**
- **Que la IA ofrezca un horario ocupado** o fuera del horario del comercial.

## Restricciones

- **Stack:** NestJS + TypeORM + PostgreSQL con pgvector, desplegado en Railway. El frontend es Next.js.
- **Reutilización de código.** Se **copian y adaptan** módulos de `D:\Github\wuarikes\huarique_backend\src\modules`, sin reescribirlos desde cero y **sin librería compartida**:
  - `whatsapp` (meta-connect, meta-webhook.util, conversations)
  - `messaging` (envío, plantillas, consumo)
  - `ai` (ai.service, vector.service)
  - `chat` (chat-processor, system-prompt, marketing-opt-out)
  - `contacts`
  - `appointments` (booking-agent, reminders, rules)

  Se conservan sus pruebas. Se cambia "local" (`placeId`) por la empresa de la suite, y se quitan lugares, niveles de plan y menú de Wuarikes.
- **Frontera de Meta.** Todo lo de Meta (conexión, webhook, envío, plantillas, consumo) vive en un módulo `canales` con una interfaz clara. Así podrá extraerse después como servicio de Mensajería de la suite sin reescribirlo.
- **App de Meta.** Se usa el App ID y el secreto de la app de Wuarikes. Al conectar, se configura `override_callback_uri` hacia el webhook de ARM **a nivel del número** (`webhook_configuration` del `phone_number_id`), **no de la cuenta**. La redirección a nivel de cuenta movería también los otros números de esa cuenta y podría romper Wuarikes. Si la API no acepta la redirección por número, ARM rechaza conectar un número cuya cuenta tenga otros números, y el piloto usa una cuenta propia. *Decisión propia.*
- **Estado de los números piloto.** Si el número sigue en la app WhatsApp Business del celular, se conecta con el registro guiado de Meta **en modo coexistencia**, como ya hace Wuarikes, y el celular sigue funcionando. Si ya está en la Cloud API, se usa `connectExisting`. *Decisión propia.*
- **Número único.** Un número no puede estar conectado en dos empresas de ARM. Al conectar, ARM avisa si el número ya está en uso, igual que valida hoy `assertNumberFree` en Wuarikes.
- **Identidad.** ARM no tiene usuarios ni contraseñas propios.
  - Valida el JWT de PuntoVenta en RS256 contra `/.well-known/jwks.json`, con el mismo issuer y audience del staff.
  - La empresa sale del claim `https://schemas.microsoft.com/identity/claims/tenantid`.
  - Exige que el claim `apps` (arreglo JSON) contenga `arm`.
- **Requisitos previos fuera de ARM:**
  - Configurar `TokenManagement__RsaPrivateKeyPem` en el PuntoVenta de producción. Sin RS256, ARM no puede validar los tokens.
  - Activar `arm` para Wuarikes y Tendy con `PUT /api/tenant/superadmin/{id}/apps`.
  - Permitir el dominio de ARM en el CORS de PuntoVenta, para el login.
- **Zona horaria:** America/Lima. La interfaz y la IA hablan en español peruano.
- **Separación por empresa:** cada tabla de ARM lleva la empresa y cada consulta filtra por ella. Hay pruebas de que una empresa no ve datos de otra.

## Lo que decidió el usuario

- **Suite estilo Zoho**, y ARM con backend propio que funciona sin ARP.
- **ARM en NestJS** reutilizando el código de Wuarikes, copiado y adaptado, no reescrito.
- **Se reutiliza la app de Meta de Wuarikes**, porque no se puede esperar meses por una aprobación nueva. El MVP tiene que salir rápido.
- **La IA responde sola** al cliente.
- **Base de conocimiento con texto, PNG, JPG, Word y Excel**, con lo necesario para que el agente sepa vender el producto. El agente también trae **su propio conocimiento** (de ventas) y **aprende de las conversaciones**.
- **Calendario propio de ARM**, sin sincronizar con Google ni Outlook.
- **Alertas y mensajes al comercial**, y **reportes para el gerente del área**.
- **Cada empresa conecta su propio celular** y en él se conversa solo sobre esa empresa (por ejemplo, el ARM de Wuarikes habla solo de Wuarikes).
- **Quién atiende:** en Wuarikes las demos las hace el dueño y/o los comerciales.
- **Embudo:**
  - Interesado: pasa al comercial y la IA se calla.
  - "Todavía no": entra en seguimiento.
  - Sin respuesta: reintentos y luego se archiva.
  - Spam o no aplica: se descarta con el motivo.

## Cómo funciona

### Líneas de producto

Lo decidió el usuario: Wuarikes vende distinto a barberías, restaurantes y spas. Por eso cada empresa tiene **una o más líneas de producto**. Wuarikes tiene tres: Barbería, Restaurante y Spa. Tendy tiene una.

**Cada línea tiene lo suyo:**
- nombre,
- criterios de calificación,
- documentos de la base de conocimiento,
- duración de la demo,
- los comerciales que hacen sus demos (si no se elige ninguno, la hacen todos los que reciben demos).

**Lo que comparte toda la empresa:**
- conocimiento general (quiénes somos, formas de pago, contacto),
- tono,
- número de WhatsApp,
- reglas de seguimiento.

**Cómo la usa la IA:**
- En los primeros mensajes, la IA identifica la línea ("¿qué tipo de negocio tienes?") y la guarda en el lead.
- Si la empresa tiene una sola línea, se asigna sola.
- Desde ese momento, busca en el conocimiento general más el de esa línea, califica con sus criterios y ofrece horarios de sus comerciales.
- El panel del gerente se puede filtrar por línea.

### Usuarios y roles

- Los usuarios existen en PuntoVenta (Cuentas). ARM guarda por empresa un **miembro**:
  - id del usuario del token,
  - nombre,
  - rol `gerente` o `comercial`,
  - celular para alertas,
  - horario de trabajo,
  - si recibe demos.
- *Decisión propia:* el primer usuario de una empresa que entra a ARM queda como `gerente`. El gerente da de alta a los demás miembros eligiendo entre los usuarios de su empresa en Cuentas, y puede marcarse a sí mismo como receptor de demos.
- El **comercial** ve sus leads, sus conversaciones y su calendario. El **gerente** ve todo lo de su empresa, configura y ve reportes.
- **Alta de miembros sin tocar PuntoVenta.** *Decisión propia.* Cualquier usuario con token válido de una empresa con `arm` que entra a ARM queda registrado como miembro **pendiente**. El primero que entra es `gerente`. El gerente activa a los pendientes y les asigna su rol. No se usa `listar-usuarios` de PuntoVenta (requiere la política de administrador).
- **Usuario con varias empresas.** *Decisión propia.* Si la empresa del token no tiene `arm`, ARM muestra las empresas del usuario (`api/autenticacion/empresas`) y cambia con `cambiar-empresa/{tenantId}`. Si después del cambio el token sigue sin `arm`, muestra "Tu empresa no tiene ARM".
- **Dueño de un lead.** *Decisión propia.* Mientras la IA califica, el lead está **sin asignar** (lo atiende la IA). Recibe un comercial cuando:
  - se agenda la demo (el que tiene el hueco libre),
  - la conversación pasa a modo humano por cualquier otra razón (por turnos, entre los miembros que reciben demos, al que tenga menos leads abiertos),
  - o el gerente lo asigna a mano.
  "Mis leads" son los que tienen dueño.

### Conexión del canal

Configuración → Canales → "Conectar WhatsApp":
1. Se abre el registro guiado de Meta.
2. ARM intercambia el código por un token y lo guarda cifrado.
3. Registra el `phone_number_id`.
4. Suscribe la cuenta con `override_callback_uri` hacia ARM.

Debe existir también la opción de conectar un número existente con su id y su token, que ya tiene `connectExisting` en Wuarikes.

Se conserva el **modo coexistencia** de Wuarikes (`recordBusinessAppEcho`): si alguien responde desde la app de WhatsApp Business del celular, ARM lo registra como mensaje humano y **la IA se calla** en esa conversación.

### Recepción de un mensaje

1. **Recepción.** El webhook de ARM verifica la firma (`X-Hub-Signature-256`), guarda el mensaje de forma idempotente (por id de Meta) y responde 200 de inmediato.
2. **Contacto y conversación.** Se busca o crea el contacto por teléfono dentro de la empresa, y su conversación abierta.
3. **Origen del anuncio.** Si el mensaje trae `referral` (anuncio que lleva a WhatsApp), se guarda en el lead: id del anuncio, título y URL de origen.
4. **Notas de voz.** Se transcriben antes de pasarlas a la IA.
5. **Modo humano.** Si la conversación está en modo humano, solo se notifica al comercial asignado.
6. **Agente.** En modo IA, el mensaje se encola (Redis/BullMQ, como Wuarikes) y el agente lo procesa.

### Agente de IA

**Contexto que recibe:**
- Últimos mensajes y memoria del cliente (datos ya extraídos del lead).
- Fragmentos relevantes de la base de conocimiento.
- Configuración del agente de la empresa: nombre del producto, tono, criterios de calificación, duración de la demo.

**Lo que hace:**
- Responde.
- Extrae y actualiza los campos del lead, guardando con cada dato la frase del cliente que lo respalda.
- Ajusta el puntaje de 0 a 100.
- Decide la etapa.

**Calificación.** Los criterios son **texto configurable por empresa**. *Decisión propia:* se precargan los propuestos en la conversación:
- Wuarikes: dueño o encargado, negocio funcionando, dolor concreto, acepta horario.
- Tendy: empresa de reparto o tienda que reparte, volumen de pedidos, dolor de coordinación o caja, acepta horario.

**Agenda.** Se copia el principio de `booking-agent`: **la IA solo entiende lo que pide el cliente; los horarios libres los calcula el servidor**.
- El servidor ofrece 2 o 3 horarios.
- El cliente elige y se crea la demo con el comercial que tiene ese hueco libre.
- Si hay empate, gana el que tiene menos demos esa semana.
- Reprogramar y cancelar también se hace desde el chat.

**No inventar.**
- Los datos de producto (precio, funciones, plazos, condiciones) **solo** pueden salir de la base de conocimiento.
- Si no están, la IA responde que lo confirma, crea una **pregunta sin respuesta** y avisa al comercial o al gerente.
- Lo dudoso sobre el cliente se guarda como **sugerencia**, no como dato.

**Traspaso al humano.** La conversación pasa a modo humano y la IA se calla cuando:
- se agenda la demo,
- el cliente pide una persona,
- el cliente se muestra molesto,
- un humano responde.

El comercial puede devolverla a la IA con un botón.

**Interruptor por empresa:** `responde sola` (por defecto) o `propone`. En `propone`, la respuesta queda como borrador y un humano la envía.

**Fuera de alcance del producto.** Si escribe un cliente final (por ejemplo, alguien que quiere reservar un corte), la IA le explica amablemente que ese número es del software y marca el lead como descartado (`no aplica`).

### Base de conocimiento

| Formato | Tratamiento |
|---|---|
| Texto escrito en ARM | Se guarda tal cual |
| Word (.docx) | Se extrae el texto con `mammoth` |
| Excel (.xlsx) | Se lee como tabla con `xlsx`: cada fila se guarda como texto "columna: valor", para que la IA no mezcle filas |
| PDF | Se extrae el texto con `pdf-parse` (*decisión propia*: la librería ya viene con el código copiado) |
| PNG / JPG | Un modelo con visión extrae el texto y la descripción. La imagen queda disponible para que la IA la **envíe** al cliente cuando sea pertinente |

Todo se divide en fragmentos, se convierte en embeddings y se busca por similitud con pgvector, filtrando por empresa (`vector.service`).

**Aprendizaje:**
- **Memoria por cliente:** automática, con los campos del lead y el historial.
- **Preguntas sin respuesta:** se listan. Cuando un humano las responde, ARM propone agregar la pregunta y su respuesta a la base, y un gerente la aprueba con un clic.
- **Nada se aprende sin aprobación humana.**

### Embudo

*Decisión propia sobre los nombres de las etapas:*

| Etapa | Cuándo |
|---|---|
| **Nuevo** | Primer mensaje |
| **En conversación** | La IA está calificando |
| **Demo agendada** | Tiene cita; pasa al comercial |
| **Demo realizada** / **No asistió** | La marca el comercial |
| **Ganado** / **Perdido** (con motivo) | Lo marca el comercial |
| **En seguimiento** | "Todavía no" |
| **Archivado** | Sin respuesta tras los reintentos |
| **Descartado** (con motivo) | Spam o no aplica |

La vista del embudo es un tablero por etapa con filtros por comercial y por fecha. El comercial puede mover leads a mano y reasignarlos (el gerente también).

### Calendario

- **Por miembro:** horario semanal, bloqueos y demos.
- **Duración de la demo** por empresa (*decisión propia*: 30 minutos por defecto) y margen entre citas.
- **Citas manuales.** El comercial puede crear una cita a mano y bloquea igual que las de la IA.
- **Link de reunión.** El comercial lo pega en la cita y se incluye en los recordatorios.
- **Recordatorios al cliente** por WhatsApp: confirmación al agendar, 24 horas antes y 2 horas antes (`reminders` de Wuarikes).
- **Aviso al comercial** 30 minutos antes.

### Seguimiento

- **"Todavía no":**
  - Mensaje a los N días y otro a los M días, configurables por empresa (*decisión propia*: 3 y 7).
  - Si pasaron más de 24 horas desde el último mensaje del cliente, se envía con **plantilla aprobada**.
  - Se detiene si el cliente responde.
- **Sin respuesta:** 2 recordatorios y luego pasa a Archivado.
- **Baja:** si el cliente pide no ser contactado, se marca y no se le vuelve a escribir (`marketing-opt-out`).

### Alertas

Se envían por dos vías:
- **Dentro de ARM:** campanita en tiempo real.
- **Por WhatsApp al celular del miembro**, desde el número conectado de la empresa y con plantilla de utilidad.

Cada miembro elige cuáles recibe. *Decisión propia:* si el celular de alertas del miembro es el mismo número conectado de la empresa, no se envía por WhatsApp (el número se escribiría a sí mismo) y solo queda la campanita.

| Evento | Destinatario |
|---|---|
| Demo agendada (con resumen del lead) | Comercial |
| Demo en 30 minutos | Comercial |
| El cliente respondió en una conversación en modo humano | Comercial |
| Lead asignado o reasignado | Comercial |
| Pregunta sin respuesta | Comercial y gerente |
| Lead sin atender: conversación en modo humano cuyo último mensaje es del cliente y lleva X minutos sin respuesta humana, contando solo dentro del horario del comercial (*decisión propia*: 15). En modo `propone` cuenta también un borrador sin enviar | Recordatorio al comercial; a los 2X minutos, aviso al gerente |
| Resumen diario a las 8:00 (citas del día, leads nuevos, pendientes) | Cada miembro |

### Panel del gerente

- **Por rango de fechas y por comercial:**
  - Leads nuevos.
  - Tiempo de primera respuesta, con dos cifras: la de la IA y la del humano desde el traspaso.
  - Leads calificados, demos agendadas, realizadas y no asistidas.
  - Ganados y perdidos, con sus motivos.
  - Descartados.
- **Origen:** número de leads, demos y ganados **por anuncio de Meta** (id y título del `referral`) y "sin anuncio".
- **Exportación a Excel** de los leads y de las métricas.

**KPIs para saber cómo van las ventas y qué está fallando.** El usuario pidió más KPIs; esta selección es *propuesta propia*. Todos se filtran por rango de fechas, línea de producto, comercial y origen. Cada uno se muestra **comparado con el período anterior** (flecha y %), y se marca en rojo cuando empeora más de 20 % (*decisión propia*).

| Pregunta | KPI |
|---|---|
| ¿Cuánto vendemos? | Ventas ganadas (cantidad y monto), ticket promedio, monto por línea y por comercial. Al marcar **Ganado**, el comercial ingresa el monto y el plan |
| ¿Dónde se cae la gente? | Embudo con **tasa de paso entre etapas**: leads → calificados → demo agendada → demo realizada → ganado. Se resalta la etapa con mayor caída |
| ¿Qué tan rápido avanzamos? | Tiempo promedio entre etapas y **ciclo de venta** (primer mensaje → ganado) |
| ¿Por qué perdemos? | Distribución de **motivos de pérdida** y de **motivos de descarte** |
| ¿Llegan los clientes a la demo? | **Tasa de asistencia** (realizadas / agendadas) y no-asistencias por comercial |
| ¿Cómo rinde cada comercial? | Demos realizadas, tasa de cierre (ganados / demos realizadas), tiempo de primera respuesta humana, leads sin atender, monto vendido |
| ¿Cómo rinde la IA? | Tiempo de primera respuesta, % de leads calificados sin intervención humana, preguntas sin respuesta (las que más se repiten), traspasos por enojo o por pedido de humano, bajas (personas que pidieron no ser contactadas) |
| ¿Funciona el seguimiento? | % de leads "en seguimiento" que vuelven a responder y % que llegan a demo |
| ¿Qué publicidad conviene? | Leads, demos, ganados y monto **por anuncio y campaña**. Con el gasto de Meta Ads (copiando `meta-ads` de Wuarikes, que usa permisos ya aprobados): **costo por lead, costo por demo y costo por venta** |
| ¿Cuándo escriben? | Leads por día de la semana y hora, y % fuera del horario de los comerciales |
| ¿Qué viene? | Demos agendadas para los próximos 7 días y leads en seguimiento activos |

### Pantallas (frontend Next.js)

1. Login, contra el endpoint de login de PuntoVenta.
2. Bandeja, con conversación, panel del lead y pestaña **Agente** (qué hizo la IA y por qué).
3. Embudo.
4. Calendario.
5. Base de conocimiento, con preguntas sin respuesta.
6. Configuración: canales, agente, criterios, seguimiento, miembros y alertas.
7. Panel del gerente.

## Queda a criterio del constructor

- Estructura del repositorio. *Sugerencia:* repo nuevo `D:\Github\arm` con `api/` (NestJS) y `web/` (Next.js), sin turborepo.
- Modelo de IA y de embeddings. Se reutilizan `ai.service` y `vector.service` con sus proveedores (Gemini, Claude u OpenRouter).
- Proveedor de transcripción de audio.
- Tiempo real (WebSocket o SSE), cifrado de tokens de Meta y esquema exacto de tablas.
- Diseño visual. Se sigue el estilo del panel de Wuarikes cuando no haya otra indicación.
- Orden de construcción. El orden natural es: base y login → canal y bandeja con respuesta humana → agente y base de conocimiento → embudo y traspaso → calendario y agenda → seguimiento y alertas → panel.
