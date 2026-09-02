/**
 * A small cache abstraction for read-mostly, non-volatile representations
 * only — see README "Caching strategy". Never used for availability,
 * eligibility, verification, or lifecycle status: those are read fresh from
 * PostgreSQL on every request because staleness there is a correctness bug,
 * not a performance nuisance.
 */
export interface Cache {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}
