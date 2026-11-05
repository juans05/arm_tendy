import { IaService, Proveedor } from './ia.service';

const proveedor = (
  nombre: string,
  responde: () => Promise<unknown>,
): Proveedor => ({
  nombre,
  modelo: `${nombre}-modelo`,
  cliente: {
    chat: { completions: { create: jest.fn(responde) } },
    embeddings: { create: jest.fn() },
  } as unknown as Proveedor['cliente'],
});

const ok = (texto: string) => async () => ({
  choices: [{ message: { content: texto } }],
  usage: { prompt_tokens: 120, completion_tokens: 30 },
});

describe('IaService', () => {
  it('usa el principal y devuelve texto, modelo y tokens', async () => {
    const ia = new IaService([proveedor('a', ok('hola'))]);
    await expect(ia.chat([{ role: 'user', content: 'x' }])).resolves.toEqual({
      texto: 'hola',
      modelo: 'a-modelo',
      tokensEntrada: 120,
      tokensSalida: 30,
    });
  });

  it('si el principal falla pasa al respaldo', async () => {
    const malo = proveedor('a', async () => {
      throw new Error('saturado');
    });
    const ia = new IaService([malo, proveedor('b', ok('desde b'))]);
    const r = await ia.chat([{ role: 'user', content: 'x' }]);
    expect(r.modelo).toBe('b-modelo');
  });

  it('respuesta vacía cuenta como falla', async () => {
    const ia = new IaService([
      proveedor('a', ok('  ')),
      proveedor('b', ok('bien')),
    ]);
    expect((await ia.chat([{ role: 'user', content: 'x' }])).texto).toBe(
      'bien',
    );
  });

  it('sin proveedores que respondan lanza error', async () => {
    const ia = new IaService([
      proveedor('a', async () => {
        throw new Error('caído');
      }),
    ]);
    await expect(ia.chat([{ role: 'user', content: 'x' }])).rejects.toThrow(
      'La IA no está disponible',
    );
  });

  it('sin configuración no está activa', () => {
    expect(new IaService([]).activa()).toBe(false);
  });
});
