import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../../../../app/context.js';
import { requireProvider } from '../../../../middleware/requireAuth.js';
import { createServiceAreaBodySchema, serviceAreaIdParamSchema } from '../../../../schemas/serviceAreas.js';
import { requireProviderByUserId } from '../../../../services/providerService.js';
import { createServiceArea, listServiceAreas, removeServiceArea } from '../../../../services/serviceAreaService.js';

export function registerMyServiceAreasRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/v1/providers/me/service-areas', { preHandler: requireProvider }, async (request) => {
    const provider = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    return { data: await listServiceAreas(ctx.pool, provider.id) };
  });

  app.post('/api/v1/providers/me/service-areas', { preHandler: requireProvider }, async (request, reply) => {
    const body = createServiceAreaBodySchema.parse(request.body);
    const provider = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    const area = await createServiceArea(ctx.pool, provider.id, body);
    reply.status(201);
    return area;
  });

  app.delete('/api/v1/providers/me/service-areas/:id', { preHandler: requireProvider }, async (request, reply) => {
    const params = serviceAreaIdParamSchema.parse(request.params);
    const provider = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    await removeServiceArea(ctx.pool, provider.id, params.id);
    reply.status(204);
  });
}
