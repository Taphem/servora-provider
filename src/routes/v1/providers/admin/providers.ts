import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../../../../app/context.js';
import { requireAdmin } from '../../../../middleware/requireAuth.js';
import { idParamSchema } from '../../../../schemas/common.js';
import { adminSetStatusBodySchema, adminSetVerificationBodySchema, buildAdminListProvidersQuerySchema } from '../../../../schemas/providers.js';
import {
  listProviders,
  recordVerificationDecision,
  requireProviderById,
  setProviderStatus,
} from '../../../../services/providerService.js';
import { toAdminProviderDto } from '../../../../dto/providerDto.js';

/**
 * Administrative provider-management surface. Distinct from the public
 * /api/v1/providers surface: this sees every status/verification state and
 * returns the full admin DTO (see dto/providerDto.ts), never exposed to a
 * customer or to the provider themselves.
 */
export function registerAdminProviderRoutes(app: FastifyInstance, ctx: AppContext): void {
  const querySchema = buildAdminListProvidersQuerySchema(ctx.env.DEFAULT_PAGE_SIZE, ctx.env.MAX_PAGE_SIZE);

  app.get('/api/v1/providers/admin', { preHandler: requireAdmin }, async (request) => {
    const query = querySchema.parse(request.query);
    const page = await listProviders(ctx.pool, {
      includeAllStatuses: true,
      status: query.status,
      verificationStatus: query.verificationStatus,
      page: query.page,
      pageSize: query.pageSize,
    });
    return { data: page.data.map(toAdminProviderDto), pagination: page.pagination };
  });

  app.get('/api/v1/providers/admin/:id', { preHandler: requireAdmin }, async (request) => {
    const params = idParamSchema.parse(request.params);
    const provider = await requireProviderById(ctx.pool, params.id);
    return toAdminProviderDto(provider);
  });

  app.patch('/api/v1/providers/admin/:id/status', { preHandler: requireAdmin }, async (request) => {
    const params = idParamSchema.parse(request.params);
    const body = adminSetStatusBodySchema.parse(request.body);
    const provider = await setProviderStatus(ctx.pool, ctx.cache, params.id, body.status, 'admin', body.reason);
    return toAdminProviderDto(provider);
  });

  app.patch('/api/v1/providers/admin/:id/verification', { preHandler: requireAdmin }, async (request) => {
    const params = idParamSchema.parse(request.params);
    const body = adminSetVerificationBodySchema.parse(request.body);
    const provider = await recordVerificationDecision(
      ctx.pool,
      ctx.cache,
      params.id,
      body.verificationStatus,
      request.identity!.userId,
      body.notes,
    );
    return toAdminProviderDto(provider);
  });
}
