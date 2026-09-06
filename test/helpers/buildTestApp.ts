import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app/buildApp.js';
import type { AppContext } from '../../src/app/context.js';
import { loadEnv } from '../../src/config/env.js';
import { createPool } from '../../src/db/pool.js';
import { createLogger } from '../../src/observability/logger.js';
import { InMemoryCache } from '../../src/cache/InMemoryCache.js';
import { FakeServicesClient } from './fakeServicesClient.js';

export interface TestApp {
  app: FastifyInstance;
  ctx: AppContext;
  servicesClient: FakeServicesClient;
  close: () => Promise<void>;
}

export function buildTestApp(envOverrides: Record<string, string> = {}): TestApp {
  const env = loadEnv({
    ...process.env,
    NODE_ENV: 'test',
    // Health-route tests intentionally do not connect to Postgres, but the
    // application still validates its production-shaped configuration.
    DATABASE_URL: process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'] ?? 'postgresql://provider:provider@localhost:5434/servora_provider',
    LOG_LEVEL: 'silent',
    SERVICES_API_BASE_URL: process.env['SERVICES_API_BASE_URL'] ?? 'http://localhost:4004',
    CLOUDINARY_CLOUD_NAME: 'servora-test',
    CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret',
    CLOUDINARY_PROVIDER_UPLOAD_PRESET: 'servora_provider_photos',
    ...envOverrides,
  });

  const pool = createPool(env.DATABASE_URL);
  const logger = createLogger(env);
  const servicesClient = new FakeServicesClient();

  const ctx: AppContext = { env, pool, logger, cache: new InMemoryCache(), servicesClient };
  const app = buildApp(ctx);

  return {
    app,
    ctx,
    servicesClient,
    close: async () => {
      await app.close();
      await pool.end();
    },
  };
}

export async function resetDatabase(ctx: AppContext): Promise<void> {
  await ctx.pool.query(
    `TRUNCATE availability_date_overrides, availability_weekly_slots, service_areas,
              provider_services, provider_skills, skills, providers
     RESTART IDENTITY CASCADE`,
  );
}

export const ADMIN_HEADERS = { 'x-user-id': '11111111-1111-1111-1111-111111111111', 'x-user-role': 'ADMIN' };
export const CUSTOMER_HEADERS = { 'x-user-id': '22222222-2222-2222-2222-222222222222', 'x-user-role': 'CUSTOMER' };
export const PROVIDER_HEADERS = { 'x-user-id': '33333333-3333-3333-3333-333333333333', 'x-user-role': 'BUSINESS_OWNER' };
export const OTHER_PROVIDER_HEADERS = { 'x-user-id': '44444444-4444-4444-4444-444444444444', 'x-user-role': 'BUSINESS_OWNER' };
