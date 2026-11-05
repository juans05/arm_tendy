import { describe, expect, it } from 'vitest';
import { destinoTrasMe } from './sesion';

describe('destinoTrasMe', () => {
  it('401 → login', () => expect(destinoTrasMe({ status: 401 })).toBe('/login'));
  it('403 SIN_ARM → elegir empresa', () => expect(destinoTrasMe({ status: 403, code: 'SIN_ARM' })).toBe('/elegir-empresa'));
  it('403 pendiente → pendiente', () => expect(destinoTrasMe({ status: 403, code: 'MIEMBRO_PENDIENTE' })).toBe('/pendiente'));
  it('403 inactivo → pendiente', () => expect(destinoTrasMe({ status: 403, code: 'MIEMBRO_INACTIVO' })).toBe('/pendiente'));
  it('200 gerente → miembros', () => expect(destinoTrasMe({ status: 200, rol: 'gerente', estado: 'activo' })).toBe('/miembros'));
  it('200 comercial → líneas', () => expect(destinoTrasMe({ status: 200, rol: 'comercial', estado: 'activo' })).toBe('/lineas'));
  it('200 pero pendiente → pendiente', () => expect(destinoTrasMe({ status: 200, rol: 'comercial', estado: 'pendiente' })).toBe('/pendiente'));
  it('error inesperado → login', () => expect(destinoTrasMe({ status: 500 })).toBe('/login'));
});
