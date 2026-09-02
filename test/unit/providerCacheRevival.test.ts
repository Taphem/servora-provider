import { describe, expect, it } from 'vitest';
import { getProviderByIdOrSlug } from '../../src/services/providerService.js';
import { toPrivateProviderDto, toPublicProviderDto } from '../../src/dto/providerDto.js';
import type { Cache } from '../../src/cache/Cache.js';
import type { DbPool } from '../../src/db/pool.js';
import { ProviderStatus, VerificationStatus, type Provider } from '../../src/domain/types.js';

/**
 * Mimics RedisCache's actual behavior (values pass through
 * JSON.stringify/parse) rather than InMemoryCache's pass-by-reference
 * storage. This distinction matters: a bug where cached Date fields come
 * back as plain strings only reproduces against a serializing backend —
 * see providerService.ts reviveProviderDates, added after this exact bug
 * was found testing against a real Redis instance (JSON round-tripping
 * silently turns Provider.createdAt from a Date into a string, which then
 * throws inside toPublicProviderDto's .toISOString() call).
 */
class SerializingFakeCache implements Cache {
  private readonly store = new Map<string, string>();

  async get<T>(key: string): Promise<T | undefined> {
    const raw = this.store.get(key);
    return raw === undefined ? undefined : (JSON.parse(raw) as T);
  }

  async set<T>(key: string, value: T, _ttlSeconds: number): Promise<void> {
    this.store.set(key, JSON.stringify(value));
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }
}

function fixtureProvider(): Provider {
  return {
    id: '99999999-9999-4999-8999-999999999001',
    userId: '99999999-9999-4999-8999-999999999002',
    displayName: 'Jane Plumber',
    slug: 'jane-plumber',
    bio: null,
    profilePhotoUrl: null,
    yearsExperience: null,
    businessName: null,
    languages: [],
    timezone: 'UTC',
    status: ProviderStatus.ACTIVE,
    verificationStatus: VerificationStatus.VERIFIED,
    verificationNotes: null,
    verificationReviewedBy: '99999999-9999-4999-8999-999999999003',
    verificationReviewedAt: new Date('2026-01-01T00:00:00.000Z'),
    disabledReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };
}

describe('getProviderByIdOrSlug cache revival', () => {
  it('returns Date-typed fields on a cache hit even from a JSON-serializing cache backend', async () => {
    const cache = new SerializingFakeCache();
    const provider = fixtureProvider();
    await cache.set('provider:public:jane-plumber', provider, 60);

    // The pool is never touched: includeInactive=false and the cache is
    // already populated, so a real DB connection isn't needed here.
    const unusedPool = {} as unknown as DbPool;
    const result = await getProviderByIdOrSlug(unusedPool, cache, 'jane-plumber', false);

    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(result.verificationReviewedAt).toBeInstanceOf(Date);
    expect(() => toPublicProviderDto(result)).not.toThrow();
    expect(() => toPrivateProviderDto(result)).not.toThrow();
    expect(toPublicProviderDto(result).createdAt).toBe('2026-01-01T00:00:00.000Z');
  });
});
