import { describe, expect, it } from 'vitest';
import { destinoTrasMe, errorTrasLogin } from './sesion';

describe('destinoTrasMe', () => {
  it('401 → login', () => expect(destinoTrasMe({ status: 401 })).toBe('/login'));
  it('403 SIN_ARM → elegir empresa', () => expect(destinoTrasMe({ status: 403, code: 'SIN_ARM' })).toBe('/elegir-empresa'));
  it('403 pendiente → pendiente', () => expect(destinoTrasMe({ status: 403, code: 'MIEMBRO_PENDIENTE' })).toBe('/pendiente'));
  it('403 inactivo → pendiente', () => expect(destinoTrasMe({ status: 403, code: 'MIEMBRO_INACTIVO' })).toBe('/pendiente'));
  it('200 gerente activo → bandeja', () => expect(destinoTrasMe({ status: 200, rol: 'gerente', estado: 'activo' })).toBe('/bandeja'));
  it('200 comercial activo → bandeja', () => expect(destinoTrasMe({ status: 200, rol: 'comercial', estado: 'activo' })).toBe('/bandeja'));
  it('200 pero pendiente → pendiente', () => expect(destinoTrasMe({ status: 200, rol: 'comercial', estado: 'pendiente' })).toBe('/pendiente'));
  it('error inesperado → login', () => expect(destinoTrasMe({ status: 500 })).toBe('/login'));
});

describe('errorTrasLogin', () => {
  it('401 justo después de entrar → mensaje, no rebote silencioso', () =>
    expect(errorTrasLogin(401)).toBe('ARM no pudo validar tu sesión. Avisa al administrador.'));
  it('503 → Cuentas no disponible', () =>
    expect(errorTrasLogin(503)).toBe('ARM no puede comunicarse con Cuentas en este momento. Intenta de nuevo.'));
  it('sin conexión → mensaje', () => expect(errorTrasLogin(0)).toBe('No se pudo conectar con ARM. Intenta de nuevo.'));
  it('200 o 403 → sin error (sigue el flujo normal)', () => {
    expect(errorTrasLogin(200)).toBeNull();
    expect(errorTrasLogin(403)).toBeNull();
  });
});
