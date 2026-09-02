import type { Cache } from './Cache.js';

interface Entry {
  value: unknown;
  expiresAt: number;
}

/**
 * Default cache backend when REDIS_URL is not configured. Fine for local
 * development and a single-instance deployment; does not share state across
 * instances, unlike RedisCache. Never authoritative — see Cache.ts.
 */
export class InMemoryCache implements Cache {
  private readonly store = new Map<string, Entry>();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}
