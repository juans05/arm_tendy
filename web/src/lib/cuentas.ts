// Login de la suite: lo atiende PuntoVenta (Cuentas). Responde MessageResult { code, message, data }.
import { leerToken } from './sesion';

const CUENTAS = process.env.NEXT_PUBLIC_CUENTAS_URL ?? 'http://localhost:3001';

export interface EmpresaAcceso {
  tenantId: number;
  nombre: string;
  activa: boolean;
}

async function llamar(path: string, init: RequestInit = {}) {
  const token = leerToken();
  const res = await fetch(`${CUENTAS}/api/autenticacion${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

function tokenDe(body: { message?: string; data?: { token?: string; messageData?: string } }): string {
  const token = body?.data?.token;
  if (!token) throw new Error(body?.message || body?.data?.messageData || 'No se pudo iniciar sesión');
  return token;
}

export async function login(userName: string, password: string): Promise<string> {
  const { body } = await llamar('/token', { method: 'POST', body: JSON.stringify({ userName, password }) });
  return tokenDe(body);
}

export async function empresas(): Promise<EmpresaAcceso[]> {
  const { res, body } = await llamar('/empresas');
  if (!res.ok) throw new Error(body?.message || 'No se pudieron cargar tus empresas');
  return body?.data ?? [];
}

export async function cambiarEmpresa(tenantId: number): Promise<string> {
  const { body } = await llamar(`/cambiar-empresa/${tenantId}`, { method: 'POST' });
  return tokenDe(body);
}
