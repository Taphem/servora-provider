import type { Env } from '../config/env.js';
import type { DbPool } from '../db/pool.js';
import type { Logger } from '../observability/logger.js';
import type { Cache } from '../cache/Cache.js';
import type { ServicesClient } from '../clients/servicesClient.js';

export interface AppContext {
  env: Env;
  pool: DbPool;
  logger: Logger;
  cache: Cache;
  servicesClient: ServicesClient;
}
