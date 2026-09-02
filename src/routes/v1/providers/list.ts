import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../../../app/context.js';
import { isAdminIdentity } from '../../../middleware/identity.js';
import { idOrSlugParamSchema } from '../../../schemas/common.js';
import { buildListProvidersQuerySchema } from '../../../schemas/providers.js';
import { getProviderByIdOrSlug, listProviders } from '../../../services/providerService.js';
import { toPublicProviderDto } from '../../../dto/providerDto.js';
import type { Page } from '../../../utils/pagination.js';
import type { Provider } from '../../../domain/types.js';

export function registerListProvidersRoute(app: FastifyInstance, ctx: AppContext): void {
  const querySchema = buildListProvidersQuerySchema(ctx.env.DEFAULT_PAGE_SIZE, ctx.env.MAX_PAGE_SIZE);

  app.get('/api/v1/providers', async (request) => {
    const query = querySchema.parse(request.query);
    const includeAllStatuses = isAdminIdentity(request.identity);

    const page: Page<Provider> = await listProviders(ctx.pool, {
      includeAllStatuses,
      serviceId: query.serviceId,
      skillId: query.skillId,
      city: query.city,
      countryCode: query.countryCode,
      page: query.page,
      pageSize: query.pageSize,
    });

    return { data: page.data.map(toPublicProviderDto), pagination: page.pagination };
  });
}

export function registerGetProviderRoute(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/v1/providers/:idOrSlug', async (request) => {
    const params = idOrSlugParamSchema.parse(request.params);
    const provider = await getProviderByIdOrSlug(ctx.pool, ctx.cache, params.idOrSlug, isAdminIdentity(request.identity));
    return toPublicProviderDto(provider);
  });
}
