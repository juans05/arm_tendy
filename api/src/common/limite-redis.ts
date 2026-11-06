import { OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

// Ventana fija por minuto: suma un golpe y, si pasa el límite, bloquea por blockDuration.
const SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
local bloqueo = redis.call('PTTL', KEYS[2])
if bloqueo <= 0 and hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], 1, 'PX', ARGV[3])
  bloqueo = tonumber(ARGV[3])
end
return {hits, ttl, bloqueo}`;

/** Límite de peticiones compartido por todas las instancias de la API. */
export class LimiteRedis implements ThrottlerStorage, OnModuleDestroy {
  private readonly redis: Redis;

  constructor(url: string) {
    this.redis = new Redis(url, { maxRetriesPerRequest: null });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const k = `arm:limite:${throttlerName}:${key}`;
    const [hits, ttlMs, bloqueoMs] = (await this.redis.eval(
      SCRIPT,
      2,
      k,
      `${k}:bloqueo`,
      ttl,
      limit,
      blockDuration,
    )) as [number, number, number];
    return {
      totalHits: hits,
      timeToExpire: Math.ceil(ttlMs / 1000),
      isBlocked: bloqueoMs > 0,
      timeToBlockExpire: bloqueoMs > 0 ? Math.ceil(bloqueoMs / 1000) : 0,
    };
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
