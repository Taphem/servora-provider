import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../../../../app/context.js';
import { requireAdmin } from '../../../../middleware/requireAuth.js';
import { idParamSchema } from '../../../../schemas/common.js';
import { createSkillBodySchema, updateSkillBodySchema } from '../../../../schemas/skills.js';
import { createSkill, updateSkill } from '../../../../services/skillService.js';

export function registerAdminSkillsRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post('/api/v1/providers/admin/skills', { preHandler: requireAdmin }, async (request, reply) => {
    const body = createSkillBodySchema.parse(request.body);
    const skill = await createSkill(ctx.pool, body);
    reply.status(201);
    return skill;
  });

  app.patch('/api/v1/providers/admin/skills/:id', { preHandler: requireAdmin }, async (request) => {
    const params = idParamSchema.parse(request.params);
    const body = updateSkillBodySchema.parse(request.body);
    return updateSkill(ctx.pool, params.id, body);
  });
}
