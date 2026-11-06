# IA en ARM

## Proveedor

Un solo cliente compatible con la API de OpenAI (`api/src/ia/ia.service.ts`):

| Variable | Uso |
|---|---|
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | Proveedor principal (OpenRouter, Gemini, OpenAI u Ollama) |
| `AI_FALLBACK_*` | Proveedor de respaldo si el principal falla o responde vacío |
| `AI_EMBED_MODEL` | Embeddings de 1536 dimensiones para la base de conocimiento |
| `AI_VISION_MODEL`, `AI_AUDIO_MODEL` | Lectura de imágenes y transcripción de notas de voz (opcionales) |

Sin `AI_BASE_URL` ARM funciona como bandeja humana: no se crea la cola del agente.

Configuración probada (Gemini directo, endpoint compatible con OpenAI `https://generativelanguage.googleapis.com/v1beta/openai/`): `AI_MODEL=gemini-3.5-flash`, `AI_FALLBACK_MODEL=gemini-flash-lite-latest`, `AI_EMBED_MODEL=gemini-embedding-001` (devuelve 1536 dimensiones). `gemini-2.5-flash` ya no está disponible para cuentas nuevas.

## Agente comercial

- **Contexto**: empresa (nombre del agente, tono, producto), líneas con criterios, lead actual, hasta 6 fragmentos de conocimiento (búsqueda vectorial o de texto en español), horarios libres reales y los últimos 30 mensajes.
- **Defensa contra inyección**: las reglas van en el mensaje de sistema; conocimiento, lead y conversación van como datos entre etiquetas (`<conocimiento>`, `<lead>`, `<conversacion>`).
- **Salida**: JSON validado contra una lista blanca. La IA solo puede mover el lead a `en_conversacion`, `seguimiento` o `descartado`, nunca retroceder uno que ya tiene demo; los datos del cliente solo se guardan con la frase que los respalda.
- **Acciones**: responder (o dejar borrador en modo "propone"), anotar pregunta sin respuesta, elegir un horario ofrecido (el servidor crea la cita), pedir una persona o marcar baja.
- **Seguridad de concurrencia**: antes de enviar se verifica que la conversación siga en modo IA; si mientras respondía llegó otro mensaje, vuelve a atender (máximo 3 vueltas).
- **Trazabilidad**: cada llamada queda en `ejecuciones_ia` (modelo, tokens, tiempo, salida o error) y se ve en la pestaña "Agente" del chat.

## Conocimiento

Texto, Word, Excel, PDF e imágenes (la IA describe la imagen). Se trocea en fragmentos de hasta 1000 caracteres con embedding. Lo que la IA no sabe queda como pregunta; el gerente la responde y la aprueba para que entre al conocimiento.

## Límites conocidos

- No hay evaluación automática de calidad de respuestas; se revisa con las trazas.
- El costo por empresa se puede sumar desde `ejecuciones_ia` (tokens), aún sin tablero.
