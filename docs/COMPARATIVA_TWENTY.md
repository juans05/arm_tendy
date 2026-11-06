# ARM frente a Twenty

Revisión del 2026-11-05 contra la documentación pública de [Twenty](https://github.com/twentyhq/twenty) (CRM de código abierto, NestJS + Postgres + Redis, como ARM). Twenty es un CRM general y configurable; ARM es un CRM de ventas por WhatsApp con IA. La pregunta no es copiar todo, sino qué le falta a ARM para que un equipo comercial no necesite otra herramienta.

## Donde ARM ya va adelante

- WhatsApp nativo (Embedded Signup, coexistencia con la app del celular, plantillas, ventana de 24 h).
- Agente de IA que atiende, califica, responde con la base de conocimiento y agenda la demo en horarios reales.
- Seguimiento automático, recordatorios de demo, avisos de leads sin atender y resumen diario.
- Panel de ventas listo (embudo, comerciales, IA, motivos de pérdida) y costo por lead, demo y venta con Meta Ads.

Twenty no trae nada de esto de fábrica: se armaría con flujos y apps.

## Lo que falta

| # | Función de Twenty | ARM hoy | Valor para ARM | Recomendación |
|---|---|---|---|---|
| 1 | **Notas, tareas y línea de tiempo** en cada registro (tareas con responsable y vencimiento, notas, actividad) | Solo historial de etapas y el chat | Alto: el comercial anota lo que habló por teléfono y agenda su próxima acción | Hacer primero |
| 2 | **Vista de tabla** con filtros Y/O, orden múltiple, agrupar, **vistas guardadas** y **búsqueda global** | Kanban del embudo y bandeja | Alto: encontrar un lead por nombre, RUC o teléfono; listas como "demos sin venta este mes" | Hacer primero |
| 3 | **Importar CSV/Excel** con mapeo de columnas, duplicados y corrección de errores; exportar todo | Solo Excel del panel | Alto: cada empresa nueva llega con su lista de clientes | Hacer primero |
| 4 | **Campañas** (Twenty: correo con dominio propio, listas, bajas y temas) | Plantillas una a una | Alto en ARM como **campañas de WhatsApp**: segmento, plantilla, envío programado, bajas, respuestas a la bandeja | Siguiente |
| 5 | **Asistente de IA para el equipo**: preguntas en lenguaje natural sobre los datos ("¿cuántas demos tuvo Ana esta semana?"), con el contexto de la página | La IA solo habla con clientes | Alto y coherente con "CRM con IA" | Siguiente |
| 6 | **Sincronización de correo y calendario** (Google Workspace, Microsoft 365) | Calendario propio | Medio: llevar las demos al Google Calendar del comercial evita dobles reservas. El correo importa poco en un CRM de WhatsApp | Solo calendario, más adelante |
| 7 | **Empresas, personas y oportunidades** como objetos relacionados; **campos y objetos personalizados** (20+ tipos) | Contacto + un lead por conversación; datos que extrae la IA | Medio: en B2B varias personas son de la misma empresa (RUC) y cada negocio pide sus campos | Empresas y campos personalizados; objetos personalizados no |
| 8 | **Flujos visuales**: disparadores (registro creado o cambiado, horario, manual, webhook) y acciones (crear, actualizar, buscar, asignar por turnos o por carga, esperar, iterar, correo, código, IA) | Automatizaciones fijas (seguimiento, recordatorios, asignación, alertas) | Medio: unas pocas reglas configurables cubren casi todo | Reglas simples, sin editor visual |
| 9 | **API pública** REST/GraphQL con claves, documentación y **webhooks** | API solo para la web de ARM | Medio: conectar ARP (PuntoVenta), formularios web y Zapier | Webhooks salientes y claves de API |
| 10 | **Permisos por objeto, campo y registro**, roles a medida, **SSO** (SAML/OIDC) y **auditoría** | Gerente y comercial; el login es de la suite | Bajo-medio: la auditoría de cambios sí sirve; el SSO lo resuelve Cuentas | Solo auditoría |
| 11 | **Detección y fusión de duplicados** | Contacto único por teléfono | Medio cuando haya importación y empresas | Junto con el punto 3 |
| 12 | **Paneles configurables** con widgets y filtros | Panel fijo | Bajo: el panel fijo responde las preguntas del gerente | No por ahora |
| 13 | **Créditos y límites de uso** de IA por empresa y miembro | Trazas de tokens en `ejecuciones_ia`, sin límites | Medio: controla el costo de la IA por cliente | Tope mensual por empresa |
| 14 | Adjuntos, favoritos, barra lateral a medida, tema oscuro, idiomas | No | Bajo | Más adelante |
| 15 | Apps y SDK para extender con código, autoalojamiento | No aplica | No aplica (ARM es SaaS de la suite) | No |

## Orden recomendado

1. Notas, tareas y línea de tiempo del lead.
2. Tabla de leads y contactos con búsqueda global, filtros y vistas guardadas.
3. Importación por CSV/Excel con mapeo y duplicados.
4. Campañas de WhatsApp con plantillas y bajas.
5. Asistente de IA para el equipo.
6. Empresas (RUC) y campos personalizados.
7. Webhooks, claves de API y auditoría.
8. Demos en Google Calendar y tope de gasto de IA por empresa.
