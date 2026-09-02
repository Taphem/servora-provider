import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../../../../app/context.js';
import { requireProvider } from '../../../../middleware/requireAuth.js';
import { ProviderStatus } from '../../../../domain/types.js';
import { requireProviderByUserId, setProviderStatus, submitProviderForVerification } from '../../../../services/providerService.js';
import { toPrivateProviderDto } from '../../../../dto/providerDto.js';

/**
 * Self-service lifecycle actions, deliberately exposed as narrow verbs
 * rather than a raw `PATCH { status }` — a provider may only ever move
 * themselves between PENDING_ONBOARDING/PAUSED and ACTIVE, or ACTIVE to
 * PAUSED (see domain/lifecycle.ts). Disabling a provider is admin-only.
 */
export function registerMyProviderLifecycleRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post('/api/v1/providers/me/activate', { preHandler: requireProvider }, async (request) => {
    const existing = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    const provider = await setProviderStatus(ctx.pool, ctx.cache, existing.id, ProviderStatus.ACTIVE, 'provider');
    return toPrivateProviderDto(provider);
  });

  app.post('/api/v1/providers/me/pause', { preHandler: requireProvider }, async (request) => {
    const existing = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    const provider = await setProviderStatus(ctx.pool, ctx.cache, existing.id, ProviderStatus.PAUSED, 'provider');
    return toPrivateProviderDto(provider);
  });

  app.post('/api/v1/providers/me/verification/submit', { preHandler: requireProvider }, async (request) => {
    const existing = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    const provider = await submitProviderForVerification(ctx.pool, ctx.cache, existing.id);
    return toPrivateProviderDto(provider);
  });
}
