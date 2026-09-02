import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../../../../app/context.js';
import { requireProvider } from '../../../../middleware/requireAuth.js';
import { replaceProviderSkillsBodySchema } from '../../../../schemas/skills.js';
import { requireProviderByUserId } from '../../../../services/providerService.js';
import { getSkillsForProvider, replaceProviderSkillSet } from '../../../../services/skillService.js';

export function registerMyProviderSkillsRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/v1/providers/me/skills', { preHandler: requireProvider }, async (request) => {
    const provider = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    return { data: await getSkillsForProvider(ctx.pool, provider.id) };
  });

  app.put('/api/v1/providers/me/skills', { preHandler: requireProvider }, async (request) => {
    const body = replaceProviderSkillsBodySchema.parse(request.body);
    const provider = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    return { data: await replaceProviderSkillSet(ctx.pool, provider.id, body.skillIds) };
  });
}
