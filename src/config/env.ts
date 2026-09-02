import { z } from 'zod';

const rawSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4010),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis is optional supporting infrastructure for a hot-read cache (see
  // src/cache) — never authoritative. When unset, an in-process no-op cache
  // is used instead; the service works correctly either way.
  REDIS_URL: z.string().url().optional(),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),

  REQUEST_ID_HEADER: z.string().default('x-request-id'),
  BODY_LIMIT_BYTES: z.coerce.number().int().positive().default(1024 * 1024),

  // Header names the API Gateway uses to forward a verified caller's
  // identity once it has resolved their session (see
  // servora-api-gateway/src/routes/v1/proxy.ts). This service never
  // verifies a session itself — it only trusts these headers, exactly like
  // every other downstream service behind the gateway.
  USER_ID_HEADER: z.string().default('x-user-id'),
  USER_ROLE_HEADER: z.string().default('x-user-role'),

  // servora-services integration (see src/clients/servicesClient.ts).
  SERVICES_API_BASE_URL: z.string().url(),
  SERVICES_API_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

  DEFAULT_PAGE_SIZE: z.coerce.number().int().positive().max(100).default(20),
  MAX_PAGE_SIZE: z.coerce.number().int().positive().max(500).default(100),
});

export type Env = ReturnType<typeof loadEnv>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  const parsed = rawSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  const env = parsed.data;
  const isProduction = env.NODE_ENV === 'production';

  return {
    ...env,
    isProduction,
    isTest: env.NODE_ENV === 'test',
  };
}
