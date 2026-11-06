import 'dotenv/config';
import { firstValueFrom, take, timeout } from 'rxjs';
import { EventosService } from './eventos.service';

// Dos instancias de la API comparten los eventos del tiempo real por Redis.
describe('EventosService con Redis', () => {
  const a = new EventosService();
  const b = new EventosService();
  beforeAll(async () => {
    await a.onModuleInit();
    await b.onModuleInit();
  });
  afterAll(async () => {
    await a.onModuleDestroy();
    await b.onModuleDestroy();
  });

  it('lo que emite una instancia llega al SSE de la otra', async () => {
    const tenant = `t-${Date.now()}`;
    const llega = firstValueFrom(
      b.deEmpresa(tenant).pipe(take(1), timeout(3000)),
    );
    a.emitir(tenant, { tipo: 'pregunta', pregunta: { id: 'p1' } as never });
    expect(await llega).toMatchObject({
      tipo: 'pregunta',
      pregunta: { id: 'p1' },
    });
  });

  it('los procesos internos (encolar al agente) solo reciben lo de su propia instancia', () => {
    const vistos: string[] = [];
    const s1 = a.todos().subscribe(() => vistos.push('a'));
    const s2 = b.todos().subscribe(() => vistos.push('b'));
    a.emitir('x', { tipo: 'pregunta', pregunta: { id: 'p2' } as never });
    s1.unsubscribe();
    s2.unsubscribe();
    expect(vistos).toEqual(['a']);
  });
});
