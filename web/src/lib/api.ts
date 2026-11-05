import { borrarToken, leerToken } from './sesion';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type Rol = 'gerente' | 'comercial';
export type Estado = 'pendiente' | 'activo' | 'inactivo';

export interface Miembro {
  id: string;
  username: string;
  nombre: string;
  rol: Rol;
  estado: Estado;
  celularAlertas: string | null;
  recibeDemos: boolean;
}

export interface Linea {
  id: string;
  nombre: string;
  criterios: string;
  duracionDemoMin: number;
  activa: boolean;
  comerciales: Miembro[];
}

export interface Respuesta<T> {
  status: number;
  data?: T;
  code?: string;
  message?: string;
}

// Llama a la API de ARM con el token de la suite. Nunca lanza: devuelve status y, si falló, code/message.
export async function api<T>(path: string, init: RequestInit = {}): Promise<Respuesta<T>> {
  const token = leerToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  }).catch(() => null);
  if (!res) return { status: 0, message: 'No se pudo conectar con ARM' };

  const body = await res.json().catch(() => undefined);
  if (res.status === 401) borrarToken();
  if (res.ok) return { status: res.status, data: body as T };
  const message = Array.isArray(body?.message) ? body.message.join('. ') : body?.message;
  return { status: res.status, code: body?.code, message };
}

export const me = () => api<{ miembro: Miembro; empresa: string }>('/me');
