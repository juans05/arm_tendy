# API de ARM

Base: `https://<api>` (local `http://localhost:3002`). Todas las rutas piden `Authorization: Bearer <token de la suite>` salvo `/health` y el webhook. Errores: `{ statusCode, message, code? }`. Límite: 300 peticiones por minuto e IP (`LIMITE_POR_MINUTO`), compartido entre instancias por Redis.

**G** = solo gerente. **Visibilidad**: un comercial ve sus leads/conversaciones y los que no tienen dueño.

| Método y ruta | Qué hace |
|---|---|
| `GET /health` | Estado de la API y la base |
| `GET /me` | Miembro y empresa de la sesión (`SIN_ARM`, `MIEMBRO_PENDIENTE`, `MIEMBRO_INACTIVO`) |
| `GET /miembros` · `PATCH /miembros/:id` | Equipo (G) |
| `GET/PUT /miembros/:id/horarios` | Horario semanal (el comercial edita el suyo) |
| `GET /lineas` · `POST` · `PATCH /lineas/:id` | Líneas de producto (escribir: G) |
| `GET /canales` · `POST /canales/whatsapp/conectar` · `conectar-existente` · `GET /canales/whatsapp/config` | WhatsApp (G) |
| `GET/POST /webhooks/whatsapp` | Verificación y eventos de Meta (firma `x-hub-signature-256`) |
| `GET /conversaciones` | Bandeja (200 más recientes) |
| `GET/POST /conversaciones/:id/mensajes` | Leer y responder (texto libre solo dentro de 24 h: `FUERA_DE_VENTANA`) |
| `POST /conversaciones/:id/plantilla` | Enviar plantilla aprobada `{ nombre, idioma, parametros }` |
| `GET /conversaciones/:id/plantillas` | Plantillas aprobadas en Meta del número de esa conversación |
| `GET /mensajes/:id/media` | Archivo del mensaje, descargado de Meta al vuelo |
| `POST /conversaciones/:id/devolver-ia` | Devuelve la conversación a la IA |
| `GET /conversaciones/:id/lead` · `/ejecuciones` | Lead y trazas de la IA |
| `GET /eventos?token=` | SSE en tiempo real (mensaje, conversacion, lead, pregunta, alerta) |
| `GET/PUT /agente/config` | Configuración del agente, agenda y plantillas (PUT: G) |
| `GET /conocimiento` · `POST /conocimiento/texto` · `POST /conocimiento/archivo` · `DELETE /conocimiento/:id` · `GET /conocimiento/:id/imagen` | Base de conocimiento (escribir: G; archivo ≤ 10 MB: docx, xlsx, pdf, imágenes) |
| `GET /preguntas` · `PUT /preguntas/:id/respuesta` · `POST /preguntas/:id/aprobar` · `/descartar` | Preguntas sin respuesta (aprobar/descartar: G) |
| `GET /leads?etapa&lineaId&duenoId` | Embudo |
| `PATCH /leads/:id` | `{ etapa?, duenoId?, lineaId?, monto?, plan?, motivo? }`. Ganado exige monto; perdido y descartado exigen motivo; solo G reasigna (un comercial puede tomar uno sin dueño) |
| `GET /leads/:id/historial` | Cambios de etapa |
| `GET /citas?desde&hasta` · `POST /citas` · `PATCH /citas/:id` · `POST /citas/:id/estado` | Citas; cruce → 409 |
| `GET /bloqueos?desde&hasta` · `POST /bloqueos` · `DELETE /bloqueos/:id` | Bloqueos de agenda |
| `GET /alertas` · `POST /alertas/leidas` · `GET/PUT /alertas/preferencias` | Alertas del miembro |
| `GET /panel/kpis?desde&hasta&lineaId&duenoId&origen` | KPIs del período y del anterior, y `anuncios`: gasto de Meta Ads con costo por lead, demo y venta por anuncio (G) |
| `GET/PUT/DELETE /anuncios/cuenta` | Cuenta publicitaria de Meta `{ cuentaId, token }`; el token se valida con Meta y nunca se devuelve (G) |
| `GET /panel/excel?…` | Leads del período en Excel (G) |
