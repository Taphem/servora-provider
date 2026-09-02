import type { Redis } from 'ioredis';
import type { Cache } from './Cache.js';

const KEY_PREFIX = 'servora-provider:';

/**
 * Shared cache backend used when REDIS_URL is configured, so multiple
 * service instances behind a load balancer see the same cached
 * representation and invalidations from one instance are visible to all.
 * Still never authoritative — see Cache.ts.
 */
export class RedisCache implements Cache {
  constructor(private readonly client: Redis) {}

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.client.get(KEY_PREFIX + key);
    if (raw === null) {
      return undefined;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.client.set(KEY_PREFIX + key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(KEY_PREFIX + key);
  }
}
