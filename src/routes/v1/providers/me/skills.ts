import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../../../../app/context.js';
import { requireProvider } from '../../../../middleware/requireAuth.js';
import { createProviderSkillBodySchema, replaceProviderSkillsBodySchema } from '../../../../schemas/skills.js';
import { requireProviderByUserId } from '../../../../services/providerService.js';
import { createOrFindSkillByName, getSkillsForProvider, replaceProviderSkillSet } from '../../../../services/skillService.js';

export function registerMyProviderSkillsRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/api/v1/providers/me/skills', { preHandler: requireProvider }, async (request) => {
    const provider = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    return { data: await getSkillsForProvider(ctx.pool, provider.id) };
  });

  // Lets a provider define their own skill (e.g. "Split AC servicing") that
  // has no corresponding servora-services catalog entry — skills are
  // provider-specific expertise, not a mirror of the service catalog. This
  // only creates-or-finds the shared `skills` row; it does not associate it
  // with the caller, so it doesn't require an existing provider record —
  // the frontend adds the returned id to its next PUT .../me/skills call.
  app.post('/api/v1/providers/me/skills', { preHandler: requireProvider }, async (request, reply) => {
    const body = createProviderSkillBodySchema.parse(request.body);
    const skill = await createOrFindSkillByName(ctx.pool, body.name);
    reply.status(201);
    return skill;
  });

  app.put('/api/v1/providers/me/skills', { preHandler: requireProvider }, async (request) => {
    const body = replaceProviderSkillsBodySchema.parse(request.body);
    const provider = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    return { data: await replaceProviderSkillSet(ctx.pool, provider.id, body.skillIds) };
  });
}
