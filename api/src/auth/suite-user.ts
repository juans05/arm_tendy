export interface SuiteUser {
  userId: string;
  username: string;
  nombre: string;
  tenant: string;
  apps: string[];
}

export const TENANT_CLAIM = 'https://schemas.microsoft.com/identity/claims/tenantid';

// PuntoVenta manda `apps` como string con un arreglo JSON: "[\"arp\",\"arm\"]".
export function parseApps(raw: unknown): string[] {
  let valor = raw;
  if (typeof raw === 'string') {
    try { valor = JSON.parse(raw); } catch { return []; }
  }
  return Array.isArray(valor) ? valor.filter((x): x is string => typeof x === 'string') : [];
}
