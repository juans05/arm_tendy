// Token de la suite (lo emite PuntoVenta/Cuentas). Por ahora en localStorage; sin refresh: al vencer se vuelve al login.
const CLAVE = 'arm_token';

export const leerToken = () => (typeof window === 'undefined' ? null : localStorage.getItem(CLAVE));
export const guardarToken = (t: string) => localStorage.setItem(CLAVE, t);
export const borrarToken = () => localStorage.removeItem(CLAVE);

export type Destino = '/elegir-empresa' | '/pendiente' | '/login' | '/bandeja';

// Error a mostrar en el login si ARM no acepta la sesión recién creada (en vez de volver al login en silencio).
export function errorTrasLogin(status: number): string | null {
  if (status === 401) return 'ARM no pudo validar tu sesión. Avisa al administrador.';
  if (status === 503) return 'ARM no puede comunicarse con Cuentas en este momento. Intenta de nuevo.';
  if (status === 0) return 'No se pudo conectar con ARM. Intenta de nuevo.';
  return null;
}

// A dónde mandar al usuario según la respuesta de GET /me.
export function destinoTrasMe(r: { status: number; code?: string; rol?: string; estado?: string }): Destino {
  if (r.status === 403 && r.code === 'SIN_ARM') return '/elegir-empresa';
  if (r.status === 403 && (r.code === 'MIEMBRO_PENDIENTE' || r.code === 'MIEMBRO_INACTIVO')) return '/pendiente';
  if (r.status !== 200) return '/login';
  if (r.estado !== 'activo') return '/pendiente';
  return '/bandeja';
}
