import { buildApp } from './app/buildApp.js';
import type { AppContext } from './app/context.js';
import { loadEnv } from './config/env.js';
import { createPool } from './db/pool.js';
import { ReadinessState } from './health/readinessState.js';
import { createLogger } from './observability/logger.js';
import { InMemoryCache } from './cache/InMemoryCache.js';
import { RedisCache } from './cache/RedisCache.js';
import { createRedisClient, type RedisClient } from './redis/client.js';
import { HttpServicesClient } from './clients/servicesClient.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const readiness = new ReadinessState();

  const pool = createPool(env.DATABASE_URL);
  const redis: RedisClient | undefined = env.REDIS_URL ? createRedisClient(env.REDIS_URL) : undefined;
  const cache = redis ? new RedisCache(redis) : new InMemoryCache();
  const servicesClient = new HttpServicesClient({
    baseUrl: env.SERVICES_API_BASE_URL,
    timeoutMs: env.SERVICES_API_TIMEOUT_MS,
    logger,
  });

  const ctx: AppContext = { env, pool, logger, cache, servicesClient };
  const app = buildApp(ctx, readiness);

  await pool.query('SELECT 1');
  readiness.markReady();

  await app.listen({ host: env.HOST, port: env.PORT });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutting down');
    readiness.markNotReady();
    await app.close();
    await pool.end();
    if (redis) {
      redis.disconnect();
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
