import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../../../app/context.js';
import { isAdminIdentity } from '../../../middleware/identity.js';
import { idOrSlugParamSchema } from '../../../schemas/common.js';
import { listOverridesQuerySchema } from '../../../schemas/availability.js';
import { getProviderByIdOrSlug, getProviderEligibility } from '../../../services/providerService.js';
import { listProviderServiceOfferings } from '../../../services/providerServiceOfferingService.js';
import { getSkillsForProvider } from '../../../services/skillService.js';
import { listServiceAreas } from '../../../services/serviceAreaService.js';
import { getWeeklyAvailability, listOverrides } from '../../../services/availabilityService.js';

/**
 * Public (unauthenticated) read routes nested under a provider's public
 * profile. Each resolves the provider through getProviderByIdOrSlug first
 * so a customer can never enumerate sub-resources of a provider that isn't
 * publicly visible (PENDING_ONBOARDING/PAUSED/DISABLED) — that lookup 404s
 * before any sub-resource query runs.
 */
export function registerPublicProviderSubResourceRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/v1/providers/:idOrSlug/services', async (request) => {
    const params = idOrSlugParamSchema.parse(request.params);
    const provider = await getProviderByIdOrSlug(ctx.pool, ctx.cache, params.idOrSlug, isAdminIdentity(request.identity));
    const includeDisabled = isAdminIdentity(request.identity);
    return { data: await listProviderServiceOfferings(ctx.pool, provider.id, includeDisabled) };
  });

  app.get('/api/v1/providers/:idOrSlug/skills', async (request) => {
    const params = idOrSlugParamSchema.parse(request.params);
    const provider = await getProviderByIdOrSlug(ctx.pool, ctx.cache, params.idOrSlug, isAdminIdentity(request.identity));
    return { data: await getSkillsForProvider(ctx.pool, provider.id) };
  });

  app.get('/api/v1/providers/:idOrSlug/service-areas', async (request) => {
    const params = idOrSlugParamSchema.parse(request.params);
    const provider = await getProviderByIdOrSlug(ctx.pool, ctx.cache, params.idOrSlug, isAdminIdentity(request.identity));
    return { data: await listServiceAreas(ctx.pool, provider.id) };
  });

  app.get('/api/v1/providers/:idOrSlug/availability/weekly', async (request) => {
    const params = idOrSlugParamSchema.parse(request.params);
    const provider = await getProviderByIdOrSlug(ctx.pool, ctx.cache, params.idOrSlug, isAdminIdentity(request.identity));
    return { data: await getWeeklyAvailability(ctx.pool, provider.id) };
  });

  app.get('/api/v1/providers/:idOrSlug/availability/overrides', async (request) => {
    const params = idOrSlugParamSchema.parse(request.params);
    const query = listOverridesQuerySchema.parse(request.query);
    const provider = await getProviderByIdOrSlug(ctx.pool, ctx.cache, params.idOrSlug, isAdminIdentity(request.identity));
    return { data: await listOverrides(ctx.pool, provider.id, query.from, query.to) };
  });

  app.get('/api/v1/providers/:idOrSlug/eligibility', async (request) => {
    const params = idOrSlugParamSchema.parse(request.params);
    const provider = await getProviderByIdOrSlug(ctx.pool, ctx.cache, params.idOrSlug, isAdminIdentity(request.identity));
    return getProviderEligibility(ctx.pool, provider.id);
  });
}
