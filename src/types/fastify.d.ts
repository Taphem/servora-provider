import 'fastify';
import type { RequestIdentity } from '../middleware/identity.js';

declare module 'fastify' {
  interface FastifyRequest {
    identity?: RequestIdentity;
  }
}
