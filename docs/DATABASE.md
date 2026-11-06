# Base de datos

Postgres 16 con `pgvector` y `btree_gist`. Esquema por migraciones TypeORM en `api/src/database/migrations` (nunca `synchronize`). Toda tabla de negocio tiene `tenant` (la empresa de Cuentas) y toda consulta filtra por él.

| Tabla | Para qué |
|---|---|
| `miembros` | Personas de la empresa en ARM: rol (gerente/comercial), estado, celular de alertas, si recibe demos, alertas apagadas |
| `lineas_producto`, `linea_producto_comerciales` | Lo que vende la empresa, criterios de calificación, duración de la demo y comerciales asignados |
| `numeros_whatsapp` | Número conectado por Embedded Signup; el token de Meta va cifrado (AES-256-GCM) |
| `contactos` | Cliente por teléfono; `no_contactar` cuando pidió la baja |
| `conversaciones` | Una por número + contacto; modo `ia` o `humano`, no leídos, borrador de la IA, `alerta_nivel` de "sin atender" |
| `mensajes` | Entrantes y salientes; origen `cliente`, `humano`, `app_celular`, `ia` o `sistema`; `wa_message_id` único |
| `leads` | Uno por conversación: etapa, puntaje, datos con evidencia, dueño, monto, plan, motivo, origen del anuncio, traspaso y seguimiento |
| `lead_historial` | Cada cambio de etapa (de, a, quién, cuándo): base de las tasas y tiempos del panel |
| `empresas_config` | Modo del agente, tono, producto, zona horaria, margen de citas, días de seguimiento, plantillas |
| `conocimiento_docs`, `conocimiento_fragmentos` | Documentos subidos y sus trozos con embedding `vector(1536)` (índice HNSW) |
| `preguntas` | Lo que la IA no supo; el gerente las aprueba y pasan al conocimiento |
| `ejecuciones_ia` | Traza de cada llamada a la IA: modelo, tokens, tiempo, salida o error |
| `horarios`, `bloqueos`, `citas` | Calendario; `citas_sin_cruce` impide citas agendadas superpuestas del mismo miembro |
| `alertas` | Campanita por miembro |
| `notas` | Notas del equipo sobre un lead, con los miembros mencionados |
| `tareas` | Próximas acciones: responsable, vencimiento, estado (pendiente, hecha, cancelada), origen `manual` o `auto`, aviso de vencida |
| `vistas` | Filtros guardados de la tabla de leads, propios o compartidos |
| `cuentas_anuncios` | Cuenta publicitaria de Meta por empresa; token cifrado. Los leads se cruzan por `referral->>'sourceId'` (índice `IDX_leads_anuncio`) |

## Respaldo

- Producción: respaldo diario con `pg_dump -Fc` (o el respaldo automático del proveedor) y retención de 14 días como mínimo. Probar una restauración al mes en una base aparte.
- La clave `FIELD_ENCRYPTION_KEY` se respalda aparte de la base: sin ella los tokens de WhatsApp no se pueden leer.
