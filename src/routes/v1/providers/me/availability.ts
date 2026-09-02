import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../../../../app/context.js';
import { requireProvider } from '../../../../middleware/requireAuth.js';
import {
  listOverridesQuerySchema,
  overrideDateParamSchema,
  replaceWeeklyAvailabilityBodySchema,
  upsertAvailabilityOverrideBodySchema,
} from '../../../../schemas/availability.js';
import { requireProviderByUserId } from '../../../../services/providerService.js';
import {
  getWeeklyAvailability,
  listOverrides,
  removeOverride,
  replaceWeeklyAvailability,
  upsertOverride,
} from '../../../../services/availabilityService.js';

export function registerMyAvailabilityRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/v1/providers/me/availability/weekly', { preHandler: requireProvider }, async (request) => {
    const provider = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    return { data: await getWeeklyAvailability(ctx.pool, provider.id) };
  });

  app.put('/api/v1/providers/me/availability/weekly', { preHandler: requireProvider }, async (request) => {
    const body = replaceWeeklyAvailabilityBodySchema.parse(request.body);
    const provider = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    return { data: await replaceWeeklyAvailability(ctx.pool, provider.id, body) };
  });

  app.get('/api/v1/providers/me/availability/overrides', { preHandler: requireProvider }, async (request) => {
    const query = listOverridesQuerySchema.parse(request.query);
    const provider = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    return { data: await listOverrides(ctx.pool, provider.id, query.from, query.to) };
  });

  app.put('/api/v1/providers/me/availability/overrides/:date', { preHandler: requireProvider }, async (request) => {
    const params = overrideDateParamSchema.parse(request.params);
    const body = upsertAvailabilityOverrideBodySchema.parse(request.body);
    const provider = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    return upsertOverride(ctx.pool, provider.id, params.date, body);
  });

  app.delete('/api/v1/providers/me/availability/overrides/:date', { preHandler: requireProvider }, async (request, reply) => {
    const params = overrideDateParamSchema.parse(request.params);
    const provider = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    await removeOverride(ctx.pool, provider.id, params.date);
    reply.status(204);
  });
}
