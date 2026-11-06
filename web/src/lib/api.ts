import { borrarToken, leerToken } from './sesion';

export const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002';

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

// Subir archivos (multipart): no se fija Content-Type para que el navegador ponga el boundary.
export async function subir<T>(path: string, form: FormData): Promise<Respuesta<T>> {
  const token = leerToken();
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).catch(() => null);
  if (!res) return { status: 0, message: 'No se pudo conectar con ARM' };
  const body = await res.json().catch(() => undefined);
  if (res.status === 401) borrarToken();
  if (res.ok) return { status: res.status, data: body as T };
  const message = Array.isArray(body?.message) ? body.message.join('. ') : body?.message;
  return { status: res.status, code: body?.code, message };
}

// Solo estos tipos se muestran en la app; el resto (HTML, SVG…) podría correr código con la sesión.
const MOSTRABLES = /^(image\/(jpeg|png|webp|gif)|audio\/[\w.+-]+|video\/[\w.+-]+|application\/pdf)$/;
export function blobSeguro(b: Blob): Blob {
  return MOSTRABLES.test(b.type) ? b : new Blob([b], { type: 'application/octet-stream' });
}

// Archivo protegido (imagen o audio) como URL local: <img> no puede mandar el token en la cabecera.
export async function urlDeArchivo(path: string): Promise<string | null> {
  const token = leerToken();
  const res = await fetch(`${API}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => null);
  if (!res?.ok) return null;
  return URL.createObjectURL(blobSeguro(await res.blob()));
}
