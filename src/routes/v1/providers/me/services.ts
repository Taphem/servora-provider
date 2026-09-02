import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../../../../app/context.js';
import { requireProvider } from '../../../../middleware/requireAuth.js';
import { createProviderServiceBodySchema, providerServiceIdParamSchema, updateProviderServiceBodySchema } from '../../../../schemas/providerServices.js';
import { requireProviderByUserId } from '../../../../services/providerService.js';
import {
  createProviderServiceOffering,
  deleteProviderServiceOffering,
  listProviderServiceOfferings,
  updateProviderServiceOffering,
} from '../../../../services/providerServiceOfferingService.js';

export function registerMyProviderServicesRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/v1/providers/me/services', { preHandler: requireProvider }, async (request) => {
    const provider = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    return { data: await listProviderServiceOfferings(ctx.pool, provider.id, true) };
  });

  app.post('/api/v1/providers/me/services', { preHandler: requireProvider }, async (request, reply) => {
    const body = createProviderServiceBodySchema.parse(request.body);
    const provider = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    const offering = await createProviderServiceOffering(ctx.pool, ctx.servicesClient, provider.id, body, request.id);
    reply.status(201);
    return offering;
  });

  app.patch('/api/v1/providers/me/services/:serviceId', { preHandler: requireProvider }, async (request) => {
    const params = providerServiceIdParamSchema.parse(request.params);
    const body = updateProviderServiceBodySchema.parse(request.body);
    const provider = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    return updateProviderServiceOffering(ctx.pool, provider.id, params.serviceId, body);
  });

  app.delete('/api/v1/providers/me/services/:serviceId', { preHandler: requireProvider }, async (request, reply) => {
    const params = providerServiceIdParamSchema.parse(request.params);
    const provider = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    await deleteProviderServiceOffering(ctx.pool, provider.id, params.serviceId);
    reply.status(204);
  });
}
