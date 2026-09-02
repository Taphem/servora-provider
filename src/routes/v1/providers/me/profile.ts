import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../../../../app/context.js';
import { requireProvider } from '../../../../middleware/requireAuth.js';
import { createProviderBodySchema, updateProviderBodySchema } from '../../../../schemas/providers.js';
import { createProvider, requireProviderByUserId, updateProvider } from '../../../../services/providerService.js';
import { toPrivateProviderDto } from '../../../../dto/providerDto.js';

export function registerMyProviderProfileRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post('/api/v1/providers/me', { preHandler: requireProvider }, async (request, reply) => {
    const body = createProviderBodySchema.parse(request.body);
    const provider = await createProvider(ctx.pool, request.identity!.userId, body);
    reply.status(201);
    return toPrivateProviderDto(provider);
  });

  app.get('/api/v1/providers/me', { preHandler: requireProvider }, async (request) => {
    const provider = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    return toPrivateProviderDto(provider);
  });

  app.patch('/api/v1/providers/me', { preHandler: requireProvider }, async (request) => {
    const body = updateProviderBodySchema.parse(request.body);
    const existing = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    const provider = await updateProvider(ctx.pool, ctx.cache, existing.id, body);
    return toPrivateProviderDto(provider);
  });
}
