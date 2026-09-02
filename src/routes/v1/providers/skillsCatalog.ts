import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../../../app/context.js';
import { isAdminIdentity } from '../../../middleware/identity.js';
import { buildPaginationQuerySchema } from '../../../schemas/common.js';
import { listSkills } from '../../../services/skillService.js';

/**
 * Public read of the controlled skills catalog (e.g. to populate a
 * "what do you do?" picker on a provider-onboarding form). Skill catalog
 * *management* (create/update) is admin-only — see routes/v1/providers/
 * admin/skills.ts.
 */
export function registerSkillsCatalogRoute(app: FastifyInstance, ctx: AppContext): void {
  const querySchema = buildPaginationQuerySchema(ctx.env.DEFAULT_PAGE_SIZE, ctx.env.MAX_PAGE_SIZE);

  app.get('/api/v1/providers/skills', async (request) => {
    const query = querySchema.parse(request.query);
    const page = await listSkills(ctx.pool, isAdminIdentity(request.identity), query.page, query.pageSize);
    return page;
  });
}
