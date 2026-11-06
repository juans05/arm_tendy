/**
 * Solo desarrollo: empresa de demostración "vitrina" en la base local para ver la web con datos.
 *
 *   npx ts-node scripts/vitrina.ts <carpeta-de-tokens>
 *
 * Levanta un JWKS en :4999 con las claves de Cuentas más una clave de demostración, escribe
 * los tokens del gerente y de una comercial en la carpeta indicada y rellena la empresa (se
 * puede volver a correr: borra y vuelve a crear). La API debe arrancar con
 * CUENTAS_URL=http://localhost:4999 y BARRIDO=off. Nunca contra la base compartida.
 */
import 'dotenv/config';
import { writeFileSync } from 'fs';
import { createServer } from 'http';
import { join } from 'path';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { DataSource } from 'typeorm';

const TENANT = 'vitrina';
const H = 3_600_000;
const D = 24 * H;

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/localhost|127\.0\.0\.1/.test(url))
    throw new Error('La vitrina solo corre contra una base local');
  const carpeta = process.argv[2];
  if (!carpeta) throw new Error('Indica la carpeta donde dejar los tokens');

  // ---- JWKS ----
  const par = await generateKeyPair('RS256');
  const demo = {
    ...(await exportJWK(par.publicKey)),
    alg: 'RS256',
    kid: 'vitrina',
  };
  let reales: object[] = [];
  try {
    const r = await fetch(
      new URL('/.well-known/jwks.json', process.env.CUENTAS_URL),
    );
    reales = ((await r.json()) as { keys: object[] }).keys;
  } catch {
    console.warn('Cuentas no responde: solo sirve la clave de demostración');
  }
  createServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ keys: [...reales, demo] }));
  }).listen(4999);

  const token = (userId: string, nombre: string) =>
    new SignJWT({
      nameid: userId,
      username: userId.split('-')[1],
      nombre,
      'https://schemas.microsoft.com/identity/claims/tenantid': TENANT,
      apps: '["arp","arm"]',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'vitrina' })
      .setIssuer(process.env.CUENTAS_ISSUER!)
      .setAudience(process.env.CUENTAS_AUDIENCE!)
      .setExpirationTime('12h')
      .sign(par.privateKey);
  writeFileSync(
    join(carpeta, 'vitrina-tokens.json'),
    JSON.stringify({
      gerente: await token('vitrina-carla', 'Carla Mendoza'),
      comercial: await token('vitrina-diego', 'Diego Quispe'),
    }),
  );

  // ---- Datos ----
  const db = new DataSource({
    type: 'postgres',
    url,
    entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
  });
  await db.initialize();
  await sembrar(db);
  await db.destroy();
  console.log('Vitrina lista. JWKS en http://localhost:4999');
}

async function sembrar(db: DataSource) {
  const ahora = Date.now();
  const en = (ms: number) => new Date(ahora + ms);
  for (const t of [
    'alertas',
    'tareas',
    'notas',
    'vistas',
    'citas',
    'horarios',
    'lead_historial',
    'leads',
    'mensajes',
    'conversaciones',
    'contactos',
    'numeros_whatsapp',
    'linea_producto_comerciales',
    'lineas_producto',
    'miembros',
    'empresas_config',
  ]) {
    if (t === 'linea_producto_comerciales') continue;
    await db.query(`DELETE FROM "${t}" WHERE tenant = $1`, [TENANT]);
  }

  const repo = (n: string) => db.getRepository(n);
  const miembro = (
    userId: string,
    nombre: string,
    rol: string,
    recibeDemos = true,
  ) =>
    repo('Miembro').save({
      tenant: TENANT,
      userId,
      username: userId.split('-')[1],
      nombre,
      rol,
      estado: 'activo',
      recibeDemos,
      alertasOff: [],
    });
  const carla = await miembro(
    'vitrina-carla',
    'Carla Mendoza',
    'gerente',
    false,
  );
  const diego = await miembro('vitrina-diego', 'Diego Quispe', 'comercial');
  const lucia = await miembro('vitrina-lucia', 'Lucía Paredes', 'comercial');
  await miembro('vitrina-jorge', 'Jorge Salas', 'comercial');

  for (const m of [diego, lucia])
    for (const dia of [1, 2, 3, 4, 5])
      await repo('Horario').save({
        tenant: TENANT,
        miembroId: m.id,
        dia,
        desde: '09:00',
        hasta: '18:00',
      });

  const pos = await repo('LineaProducto').save({
    tenant: TENANT,
    nombre: 'Punto de venta',
    criterios: 'Tiene local abierto y vende más de S/ 5,000 al mes',
    duracionDemoMin: 30,
    activa: true,
    comerciales: [diego, lucia],
  });
  const fe = await repo('LineaProducto').save({
    tenant: TENANT,
    nombre: 'Facturación electrónica',
    criterios: 'Tiene RUC activo',
    duracionDemoMin: 20,
    activa: true,
    comerciales: [lucia],
  });
  await repo('EmpresaConfig').save({
    tenant: TENANT,
    agenteNombre: 'Valeria',
    producto:
      'Sistema de punto de venta y facturación electrónica para negocios del Perú',
  });

  const numero = await repo('NumeroWhatsapp').save({
    tenant: TENANT,
    phoneNumberId: 'vitrina-ph',
    wabaId: 'vitrina-waba',
    telefono: '51987654321',
    token: 'demo',
    coexistencia: true,
    activo: true,
  });

  type Caso = {
    nombre: string;
    tel: string;
    linea?: string;
    etapa: string;
    dueno?: string;
    puntaje: number;
    calificado?: boolean;
    monto?: number;
    plan?: string;
    motivo?: string;
    hace: number;
    modo?: 'ia' | 'humano';
    noLeidos?: number;
    alerta?: number;
    datos?: Record<string, string>;
    chat: ['cliente' | 'ia' | 'humano', string][];
    anuncio?: boolean;
  };
  const casos: Caso[] = [
    {
      nombre: 'Bodega Rosita',
      tel: '51911222333',
      linea: pos.id,
      etapa: 'nuevo',
      puntaje: 35,
      hace: 0.2 * H,
      noLeidos: 2,
      alerta: 1,
      anuncio: true,
      datos: { rubro: 'Bodega', distrito: 'San Juan de Lurigancho' },
      chat: [
        ['cliente', 'Hola, vi su anuncio. ¿Cuánto cuesta el sistema?'],
        [
          'ia',
          '¡Hola! Soy Valeria. El plan Bodega cuesta S/ 59 al mes con boletas ilimitadas. ¿Cuántas cajas tienes?',
        ],
        ['cliente', 'Una sola caja, pero quiero controlar el stock'],
      ],
    },
    {
      nombre: 'Ferretería El Sol',
      tel: '51922333444',
      linea: pos.id,
      etapa: 'en_conversacion',
      dueno: diego.id,
      puntaje: 62,
      calificado: true,
      hace: 3 * H,
      modo: 'humano',
      datos: { ruc: '20601234567', rubro: 'Ferretería', locales: '2' },
      chat: [
        ['cliente', 'Necesito algo para mis dos locales en Ate'],
        [
          'ia',
          'Perfecto, el plan Negocio maneja varios locales con un solo inventario.',
        ],
        ['cliente', 'Quiero hablar con un asesor'],
        [
          'humano',
          'Hola, soy Diego. ¿Te parece si te muestro el sistema mañana?',
        ],
      ],
    },
    {
      nombre: 'Pollería Don Lucho',
      tel: '51933444555',
      linea: pos.id,
      etapa: 'demo_agendada',
      dueno: diego.id,
      puntaje: 81,
      calificado: true,
      hace: 26 * H,
      anuncio: true,
      datos: { rubro: 'Restaurante', mesas: '18', distrito: 'Los Olivos' },
      chat: [
        ['cliente', '¿El sistema sirve para comandas en cocina?'],
        [
          'ia',
          'Sí: el mozo toma el pedido en el celular y sale impreso en cocina. ¿Agendamos una demo de 30 minutos?',
        ],
        ['cliente', 'Sí, el jueves en la tarde'],
        ['ia', 'Listo, jueves a las 4:00 pm con Diego. Te llegará el enlace.'],
      ],
    },
    {
      nombre: 'Minimarket Kory',
      tel: '51944555666',
      linea: pos.id,
      etapa: 'demo_agendada',
      dueno: lucia.id,
      puntaje: 74,
      calificado: true,
      hace: 30 * H,
      datos: { rubro: 'Minimarket', ruc: '10456789012' },
      chat: [
        ['cliente', 'Quiero ver cómo funciona con lector de código de barras'],
        [
          'ia',
          'Funciona con cualquier lector USB. Te agendo con Lucía el viernes a las 10:00 am.',
        ],
      ],
    },
    {
      nombre: 'Botica San Martín',
      tel: '51955666777',
      linea: fe.id,
      etapa: 'demo_realizada',
      dueno: lucia.id,
      puntaje: 70,
      calificado: true,
      hace: 2 * D,
      datos: { rubro: 'Farmacia', ruc: '20512345678' },
      chat: [
        [
          'humano',
          'Gracias por la reunión de hoy. Te paso la propuesta por aquí.',
        ],
        ['cliente', 'Gracias, la reviso con mi socio'],
      ],
    },
    {
      nombre: 'Restaurante La Huerta',
      tel: '51966777888',
      linea: pos.id,
      etapa: 'ganado',
      dueno: diego.id,
      puntaje: 90,
      calificado: true,
      monto: 1290,
      plan: 'Negocio anual',
      hace: 4 * D,
      datos: { rubro: 'Restaurante', ruc: '20609876543' },
      chat: [
        ['cliente', 'Listo, ya hice el depósito'],
        ['humano', '¡Bienvenidos! Mañana activamos su cuenta.'],
      ],
    },
    {
      nombre: 'Librería Andina',
      tel: '51977888999',
      linea: fe.id,
      etapa: 'perdido',
      dueno: lucia.id,
      puntaje: 40,
      motivo: 'Precio: se quedó con su proveedor actual',
      hace: 6 * D,
      chat: [['cliente', 'Por ahora seguimos con el sistema que tenemos']],
    },
    {
      nombre: 'Panadería Santa Rosa',
      tel: '51988999000',
      linea: pos.id,
      etapa: 'no_asistio',
      dueno: diego.id,
      puntaje: 58,
      hace: 1 * D,
      datos: { rubro: 'Panadería' },
      chat: [
        ['ia', 'Hola, te esperábamos en la demo de las 11:00. ¿Reagendamos?'],
      ],
    },
    {
      nombre: 'Juguería Mi Perú',
      tel: '51900111222',
      etapa: 'seguimiento',
      puntaje: 30,
      hace: 5 * D,
      chat: [
        ['cliente', 'Todavía no, de acá a un mes vemos'],
        ['ia', 'Claro, te escribo en unas semanas.'],
      ],
    },
    {
      nombre: 'Taller Mecánico Ruiz',
      tel: '51900222333',
      etapa: 'nuevo',
      puntaje: 15,
      hace: 0.6 * H,
      noLeidos: 1,
      chat: [['cliente', 'Buenas, ¿emiten facturas?']],
    },
    {
      nombre: 'Óptica Visión Clara',
      tel: '51900333444',
      linea: fe.id,
      etapa: 'en_conversacion',
      puntaje: 55,
      hace: 5 * H,
      datos: { rubro: 'Óptica', ruc: '20587654321' },
      chat: [
        ['cliente', 'Emito unas 300 boletas al mes'],
        [
          'ia',
          'El plan Facturador te alcanza: S/ 39 al mes. ¿Quieres probarlo gratis 7 días?',
        ],
      ],
    },
    {
      nombre: 'Cevichería El Muelle',
      tel: '51900444555',
      linea: pos.id,
      etapa: 'descartado',
      puntaje: 5,
      motivo: 'Buscaba trabajo, no es cliente',
      hace: 3 * D,
      chat: [['cliente', 'Hola, ¿tienen vacantes de cajero?']],
    },
  ];

  const leads: Record<string, { id: string; conv: string }> = {};
  for (const c of casos) {
    const contacto = await repo('Contacto').save({
      tenant: TENANT,
      telefono: c.tel,
      nombre: c.nombre,
      noContactar: false,
    });
    const ultimo = en(-c.hace);
    const conv = await repo('Conversacion').save({
      tenant: TENANT,
      numeroId: numero.id,
      contactoId: contacto.id,
      modo: c.modo ?? 'ia',
      ultimoMensajeEn: ultimo,
      ultimoEntranteEn: ultimo,
      noLeidos: c.noLeidos ?? 0,
      alertaNivel: c.alerta ?? 0,
    });
    const referral = c.anuncio
      ? {
          sourceId: '120210000000001',
          sourceType: 'ad',
          headline: 'Tu bodega en orden',
          sourceUrl: 'https://fb.me/vitrina',
        }
      : null;
    for (const [i, [quien, texto]] of c.chat.entries())
      await repo('Mensaje').save({
        tenant: TENANT,
        conversacionId: conv.id,
        direccion: quien === 'cliente' ? 'entrante' : 'saliente',
        origen: quien,
        tipo: 'text',
        texto,
        referral: i === 0 ? referral : null,
        autorMiembroId: quien === 'humano' ? (c.dueno ?? null) : null,
        createdAt: new Date(
          ultimo.getTime() - (c.chat.length - 1 - i) * 4 * 60_000,
        ),
      });
    const datos = Object.fromEntries(
      Object.entries(c.datos ?? {}).map(([k, v]) => [
        k,
        { valor: v, evidencia: 'del chat' },
      ]),
    );
    const lead = await repo('Lead').save({
      tenant: TENANT,
      conversacionId: conv.id,
      contactoId: contacto.id,
      lineaId: c.linea ?? null,
      etapa: c.etapa,
      etapaEn: ultimo,
      calificado: c.calificado ?? false,
      puntaje: c.puntaje,
      datos,
      sugerencias: [],
      duenoId: c.dueno ?? null,
      motivo: c.motivo ?? null,
      monto: c.monto ?? null,
      plan: c.plan ?? null,
      referral,
    });
    leads[c.nombre] = { id: lead.id, conv: conv.id };
    if (c.etapa !== 'nuevo')
      await repo('LeadHistorial').save([
        {
          tenant: TENANT,
          leadId: lead.id,
          de: 'nuevo',
          a: 'en_conversacion',
          miembroId: null,
          en: new Date(ultimo.getTime() - 2 * H),
        },
        ...(c.etapa !== 'en_conversacion'
          ? [
              {
                tenant: TENANT,
                leadId: lead.id,
                de: 'en_conversacion',
                a: c.etapa,
                miembroId: c.dueno ?? null,
                en: ultimo,
              },
            ]
          : []),
      ]);
  }

  const dia = (d: number, h: number) => {
    const x = new Date(ahora + d * D);
    x.setHours(h, 0, 0, 0);
    return x;
  };
  const cita = (
    lead: string,
    miembroId: string,
    inicio: Date,
    min: number,
    estado = 'agendada',
  ) =>
    repo('Cita').save({
      tenant: TENANT,
      leadId: leads[lead].id,
      miembroId,
      inicio,
      fin: new Date(inicio.getTime() + min * 60_000),
      estado,
      origen: 'ia',
      titulo: `Demo · ${lead}`,
      link: 'https://meet.google.com/vit-rina-arm',
    });
  await cita('Pollería Don Lucho', diego.id, dia(1, 16), 30);
  await cita('Minimarket Kory', lucia.id, dia(2, 10), 30);
  await cita('Botica San Martín', lucia.id, dia(-1, 11), 20, 'realizada');
  await cita('Panadería Santa Rosa', diego.id, dia(-1, 11), 30, 'no_asistio');

  await repo('Nota').save([
    {
      tenant: TENANT,
      leadId: leads['Ferretería El Sol'].id,
      autorId: diego.id,
      texto:
        'Hablé por teléfono con el dueño, Martín. Quiere un solo inventario para los dos locales y que el contador vea los reportes.',
      menciones: [],
      createdAt: en(-2 * H),
    },
    {
      tenant: TENANT,
      leadId: leads['Ferretería El Sol'].id,
      autorId: carla.id,
      texto: '@diego ofrécele el plan Negocio con 10% si firma este mes.',
      menciones: [diego.id],
      createdAt: en(-1 * H),
    },
    {
      tenant: TENANT,
      leadId: leads['Botica San Martín'].id,
      autorId: lucia.id,
      texto:
        'El socio decide el lunes. Les preocupa migrar los productos: ofrecer la importación por Excel.',
      menciones: [],
      createdAt: en(-20 * H),
    },
  ]);
  await repo('Tarea').save([
    {
      tenant: TENANT,
      leadId: leads['Ferretería El Sol'].id,
      titulo: 'Enviar cotización para 2 locales',
      venceEn: en(5 * H),
      responsableId: diego.id,
      creadorId: diego.id,
      origen: 'manual',
    },
    {
      tenant: TENANT,
      leadId: leads['Panadería Santa Rosa'].id,
      titulo: 'Reagendar la demo',
      venceEn: en(-3 * H),
      responsableId: diego.id,
      creadorId: null,
      origen: 'auto',
    },
    {
      tenant: TENANT,
      leadId: leads['Botica San Martín'].id,
      titulo: 'Enviar la propuesta y cerrar',
      venceEn: en(1 * D),
      responsableId: lucia.id,
      creadorId: null,
      origen: 'auto',
    },
    {
      tenant: TENANT,
      leadId: leads['Restaurante La Huerta'].id,
      titulo: 'Dar de alta al cliente en ARP',
      venceEn: en(-1 * D),
      responsableId: diego.id,
      creadorId: null,
      origen: 'auto',
      estado: 'hecha',
      hechaEn: en(-20 * H),
    },
    {
      tenant: TENANT,
      leadId: leads['Pollería Don Lucho'].id,
      titulo: 'Preparar demo de comandas en cocina',
      venceEn: en(1 * D - 2 * H),
      responsableId: diego.id,
      creadorId: diego.id,
      origen: 'manual',
    },
  ]);
  await repo('Vista').save([
    {
      tenant: TENANT,
      miembroId: carla.id,
      nombre: 'Demos de esta semana',
      filtros: { etapas: ['demo_agendada', 'demo_realizada'] },
      compartida: true,
    },
    {
      tenant: TENANT,
      miembroId: carla.id,
      nombre: 'Sin dueño',
      filtros: { duenoId: 'sin' },
      compartida: true,
    },
  ]);
  const alerta = (
    miembroId: string,
    tipo: string,
    titulo: string,
    detalle: string,
    enlace: string,
    hace: number,
    leida = false,
  ) =>
    repo('Alerta').save({
      tenant: TENANT,
      miembroId,
      tipo,
      titulo,
      detalle,
      enlace,
      leida,
      createdAt: en(-hace),
    });
  await alerta(
    diego.id,
    'mencion',
    'Carla Mendoza te mencionó en Ferretería El Sol',
    'ofrécele el plan Negocio con 10% si firma este mes.',
    `/leads/${leads['Ferretería El Sol'].id}`,
    1 * H,
  );
  await alerta(
    diego.id,
    'tarea_vencida',
    'Venció: Reagendar la demo',
    'Panadería Santa Rosa',
    `/leads/${leads['Panadería Santa Rosa'].id}`,
    3 * H,
  );
  await alerta(
    diego.id,
    'demo_agendada',
    'Demo agendada con Pollería Don Lucho',
    'Mañana 4:00 p. m.',
    '/calendario',
    26 * H,
    true,
  );
  await alerta(
    carla.id,
    'sin_atender',
    'Bodega Rosita espera respuesta',
    'Escribió hace 12 minutos',
    `/bandeja?c=${leads['Bodega Rosita'].conv}`,
    0.2 * H,
  );
  await alerta(
    carla.id,
    'resumen_diario',
    'Resumen de ayer',
    '6 leads nuevos, 2 demos, 1 venta',
    '/panel',
    10 * H,
    true,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
