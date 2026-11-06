import 'dotenv/config';
import { LimiteRedis } from './limite-redis';

// El límite de peticiones se cuenta en Redis: vale para todas las instancias juntas.
describe('LimiteRedis', () => {
  const a = new LimiteRedis(process.env.REDIS_URL!);
  const b = new LimiteRedis(process.env.REDIS_URL!);
  afterAll(async () => {
    await a.onModuleDestroy();
    await b.onModuleDestroy();
  });

  it('cuenta entre instancias y bloquea al pasar el límite', async () => {
    const k = `prueba-${Date.now()}`;
    expect((await a.increment(k, 60_000, 2, 60_000, 'default')).isBlocked).toBe(
      false,
    );
    expect((await b.increment(k, 60_000, 2, 60_000, 'default')).totalHits).toBe(
      2,
    );
    const r = await a.increment(k, 60_000, 2, 60_000, 'default');
    expect(r).toMatchObject({ totalHits: 3, isBlocked: true });
    expect(r.timeToBlockExpire).toBeGreaterThan(55);
    expect((await b.increment(k, 60_000, 2, 60_000, 'default')).isBlocked).toBe(
      true,
    );
  });
});
