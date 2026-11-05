# Arquitectura de ARM

ARM es el CRM con IA de la suite (Cuentas + ARP + ARM). Atiende el WhatsApp de ventas de cada empresa, califica leads con IA, agenda demos y le da al equipo comercial y al gerente un embudo, un calendario y un panel.

## Piezas

```
 WhatsApp (Meta Cloud API)          Navegador (web Next.js :3100, PWA)
        │ webhook firmado                     │ REST + SSE (token de la suite)
        ▼                                     ▼
 ┌──────────────────────── API NestJS (:3002) ────────────────────────┐
 │ Guards globales: límite de peticiones → token (JWKS) → miembro → rol │
 │ canales · bandeja · agente · conocimiento · leads · calendario ·    │
 │ alertas · seguimiento · reportes · lineas · miembros                │
 └───────┬───────────────────────┬──────────────────────┬─────────────┘
         ▼                       ▼                      ▼
   Postgres 16 + pgvector     Redis (BullMQ)      Proveedor de IA
   (datos y embeddings)       cola 'agente',      compatible con OpenAI
                              cola 'barrido'      (OpenRouter, Gemini…)
```

- **Cuentas** (vive dentro de PuntoVenta) emite el token RS256. ARM lo valida contra el JWKS público y exige que el claim `apps` incluya `arm`.
- **Monolito modular**: un módulo Nest por área. Un módulo no escribe en las tablas de otro, salvo `anotarEtapa` (leads) que usan el agente, el calendario y el seguimiento.

## Flujos principales

1. **Mensaje entrante.** Meta llama a `POST /webhooks/whatsapp`. Se verifica la firma, se guarda el mensaje (idempotente por `wa_message_id`), se crea o actualiza el lead y recién entonces se responde 200. Si algo falla responde 500 y Meta reintenta.
2. **Agente.** Cada mensaje del cliente encola `atender(conversación)` en BullMQ (espera 3 s para juntar mensajes seguidos; 3 intentos). El agente arma el contexto (empresa, líneas, lead, conocimiento, horarios libres, historial), pide a la IA una decisión en JSON, la valida y la aplica: responde o deja borrador, actualiza el lead, registra preguntas que no supo, agenda la demo elegida o pasa a una persona.
3. **Traspaso.** Al pasar a humano se asigna el comercial de la línea con menos leads abiertos (o uno que recibe demos) y se le avisa.
4. **Calendario.** La IA solo ofrece horarios calculados por el servidor (`huecos.ts`: horario semanal, bloqueos, citas, margen y anticipación). La base impide dos citas cruzadas del mismo comercial (`EXCLUDE USING gist`).
5. **Barrido de cada minuto** (job programado de BullMQ, una sola instancia lo corre): seguimiento a los "todavía no", leads sin atender (aviso al comercial y luego al gerente), recordatorios de demo (24 h, 2 h, 30 min) y resumen diario de las 8:00. Cada tarea deja una marca en la base para no repetirse.
6. **Tiempo real.** `GET /eventos` (SSE) emite los eventos de la empresa; las alertas solo llegan a su destinatario.

## Decisiones

| Decisión | Por qué | Costo si resulta mal |
|---|---|---|
| Webhook síncrono, sin cola | Simple y durable: Meta reintenta si no hay 200 | Con mucho tráfico conviene encolar el guardado |
| Un solo cliente de IA compatible con OpenAI | Cubre OpenRouter, Gemini, OpenAI y Ollama con una interfaz | Funciones exclusivas de un proveedor requieren adaptador |
| BullMQ directo, sin `@nestjs/bullmq` | El wrapper no soportaba la versión instalada | Algo más de código de arranque |
| Bus de eventos en memoria | Un proceso basta hoy | Con varias instancias: Redis pub/sub |
| Aislamiento por empresa en la aplicación (sin RLS) | TypeORM no permite fijar la empresa por conexión sin tocar todos los módulos | Un filtro olvidado expone datos; lo cubren pruebas de aislamiento |
| Un comercial ve sus leads y los sin dueño | Coincide con cómo trabajan los pilotos | Si se quiere ver todo, es un cambio de filtro |
