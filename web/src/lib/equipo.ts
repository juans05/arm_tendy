import { api } from './api';

export type Companero = { id: string; nombre: string; username: string; rol: 'gerente' | 'comercial' };

// Compañeros activos: una sola consulta por sesión de página.
let cache: Promise<Companero[]> | null = null;
export const cargarEquipo = () => (cache ??= api<Companero[]>('/equipo').then((r) => r.data ?? []));
