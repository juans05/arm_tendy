# ARM frente a Salesforce

Comparación con Salesforce Sales Cloud y su IA (Einstein y Agentforce), hecha el 2026-11-05 a partir de las funciones conocidas del producto, sin consultar su documentación. Solo lista lo que **no** está ya en [la comparación con Twenty](COMPARATIVA_TWENTY.md): notas y tareas, vistas y búsqueda, importación, campañas, asistente de IA, empresas y campos personalizados, API y webhooks, auditoría.

## Lo que falta

| # | Función de Salesforce | ARM hoy | Valor para ARM | Recomendación |
|---|---|---|---|---|
| 1 | **Productos, listas de precios y cotizaciones** (CPQ): planes, descuentos, cotización en PDF, **aprobación de descuentos** | Monto y plan a mano al ganar | Alto: el comercial cotiza desde el chat y la manda por WhatsApp; el gerente aprueba descuentos | Productos, cotización en PDF y aprobación simple; CPQ completo no |
| 2 | **Metas y pronóstico** (cuotas por comercial y mes; categorías *compromiso / probable / pipeline*) | Panel con lo ya ocurrido | Alto: el gerente ve si llega a la meta del mes | Metas mensuales y pronóstico por probabilidad de etapa |
| 3 | **Inspección del pipeline**: monto ponderado por etapa, cambios de la semana, oportunidades estancadas, fecha de cierre esperada | Kanban sin montos esperados ni fechas | Alto: complementa el pronóstico | Junto con el punto 2 |
| 4 | **Cadencias** (Sales Engagement): secuencias de pasos (mensaje, llamada, tarea) con días de espera, por comercial | Seguimiento automático de dos mensajes | Medio-alto: prospección y reactivación ordenada | Cadencias simples sobre WhatsApp y tareas |
| 5 | **Llamadas integradas**: llamar desde la app, registro automático, grabación, **transcripción y resumen con IA** (Conversation Insights) | No | Medio-alto: mucha venta en Perú cierra por llamada. WhatsApp ya ofrece llamadas por la Cloud API | Llamadas de WhatsApp con registro y resumen IA, más adelante |
| 6 | **IA para el comercial** (Einstein): puntaje de lead y oportunidad **explicado**, resumen del lead, borrador de mensajes, siguiente mejor acción, coach de ventas | La IA califica y atiende al cliente; el puntaje no se explica al comercial | Alto y barato: ya están los datos y la IA | Resumen del lead, por qué del puntaje y siguiente acción sugerida |
| 7 | **Agente SDR** (Agentforce): la IA prospecta y reactiva leads fríos por su cuenta, dentro de reglas | La IA solo responde a quien escribe | Medio: reactivar leads archivados con plantillas | Reactivación con IA dentro de campañas |
| 8 | **Captura web y atribución**: formularios web a lead, UTM, varias fuentes (Google, TikTok, web) | Solo anuncios de Meta | Medio: medir todo el gasto, no solo Meta | Formulario web y enlaces de WhatsApp con UTM |
| 9 | **Enriquecimiento de datos** (Data.com y socios) | Lo que dice el cliente | Alto en Perú: completar razón social, dirección y estado con el **RUC/DNI** (PuntoVenta ya consulta SUNAT) | Consulta de RUC/DNI reutilizando la integración de ARP |
| 10 | **Integración con el ERP**: de oportunidad ganada a pedido y factura | Venta ganada queda en ARM | Alto y exclusivo de la suite: al ganar, crear el cliente y la venta en ARP (PuntoVenta) | Hacer: es la ventaja de la suite |
| 11 | **Postventa** (Service Cloud): casos, SLA, base de conocimiento para soporte, renovaciones | No | Medio: las suscripciones necesitan soporte y renovación | Más adelante, como módulo aparte |
| 12 | **Reglas de asignación y colas**: por territorio, rubro, idioma u horario; colas compartidas | Comercial de la línea con menos carga | Medio | Reglas por línea, rubro y horario cuando haya equipos grandes |
| 13 | **Reglas de validación e historial de campos** | Validaciones fijas al ganar o perder | Bajo-medio | Junto con campos personalizados y auditoría |
| 14 | Colaboración (Chatter): menciones a compañeros en un registro | No | Medio: "@Ana mira este lead" | Junto con las notas (Twenty, punto 1) |
| 15 | Varias monedas, territorios jerárquicos, portal de clientes, AppExchange, sandboxes | No | Bajo o no aplica para pymes | No |

## Lo que ARM hace y Salesforce no trae de fábrica

WhatsApp nativo con coexistencia, agente que vende y agenda en horarios reales, seguimiento y recordatorios automáticos, y costo por lead, demo y venta de Meta Ads listo sin configuración. En Salesforce todo eso pide apps de terceros e implementación.

## Orden recomendado (junto con lo de Twenty)

1. Notas, tareas y línea de tiempo del lead, con menciones.
2. Tabla de leads con búsqueda global, filtros y vistas guardadas.
3. **IA para el comercial**: resumen del lead, por qué del puntaje y siguiente acción.
4. **Productos y cotización en PDF** por WhatsApp, con aprobación de descuentos.
5. **Metas, pronóstico e inspección del pipeline**.
6. Importación CSV/Excel con duplicados y **enriquecimiento por RUC/DNI**.
7. **Ganado → cliente y venta en ARP**.
8. Campañas de WhatsApp y cadencias, con reactivación por IA.
9. Asistente de IA para el equipo, empresas y campos personalizados, webhooks y auditoría.
10. Llamadas de WhatsApp con resumen IA, atribución multicanal, postventa.
