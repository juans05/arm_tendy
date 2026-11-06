# Cambios

## 0.3.0 (2026-11-05)

- Meta Ads: el gerente conecta la cuenta publicitaria en Canales y el panel muestra lo invertido, el costo por lead, demo y venta, y el retorno de cada anuncio.
- IA con Gemini (principal `gemini-3.5-flash`, respaldo `gemini-flash-lite-latest`, embeddings `gemini-embedding-001`).
- NestJS 11 (Express 5) y multer 2.5: se cierran los avisos altos de `npm audit`.
- Varias instancias: tiempo real por Redis pub/sub y límite de peticiones contado en Redis.
- Un lead sin dueño no lo pueden tomar dos comerciales a la vez.
- Las plantillas se listan y validan con el número de la conversación.
- El calendario ya no se salta el día del cambio de horario de verano.

## 0.2.0 (2026-11-05)

- Webhook durable: se guarda antes de responder 200; si falla responde 500 y Meta reintenta. Cada mensaje entrante crea su lead.
- Agente con IA: responde o propone, califica, anota preguntas sin respuesta, transcribe audios, pasa a una persona. Proveedor compatible con OpenAI con respaldo.
- Base de conocimiento: texto, Word, Excel, PDF e imágenes, búsqueda vectorial y aprobación de preguntas.
- Embudo: historial de etapas, validaciones de cierre, asignación automática al comercial con menos carga, visibilidad por dueño.
- Calendario: horarios semanales, bloqueos, citas sin cruces, la IA ofrece horarios reales y agenda la demo.
- Seguimiento automático, recordatorios de demo, avisos de leads sin atender, resumen diario, plantillas de WhatsApp y baja.
- Alertas en la campanita y por WhatsApp, con preferencias por miembro.
- Panel del gerente con KPIs comparados con el período anterior y export a Excel.
- Seguridad: helmet, límite de peticiones, CSP y cabeceras en la web.
- Dockerfiles, CI y documentación.
- Revisión final: archivos del cliente que no se abren como página, CSP compatible con el alta de WhatsApp, eventos en tiempo real y endpoints del agente filtrados por dueño, avisos de "sin atender" que se reinician al responder desde el celular o con plantilla, zona horaria validada, barrido que aísla registros con problemas, seguimientos sin envíos seguidos y cambios de etapa que no pisan los de una persona.

## 0.1.0

- Base: login de la suite vía JWKS, miembros y roles, líneas de producto, conexión de WhatsApp y bandeja con respuesta humana.
