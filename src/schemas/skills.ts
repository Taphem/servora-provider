import { z } from 'zod';
import { slugSchema, uuidSchema } from './common.js';

export const createSkillBodySchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    slug: slugSchema.optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  })
  .strict();
export type CreateSkillBody = z.infer<typeof createSkillBodySchema>;

export const updateSkillBodySchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    slug: slugSchema.optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field must be provided.' });
export type UpdateSkillBody = z.infer<typeof updateSkillBodySchema>;

export const replaceProviderSkillsBodySchema = z
  .object({
    skillIds: z.array(uuidSchema).max(50),
  })
  .strict()
  .refine((body) => new Set(body.skillIds).size === body.skillIds.length, {
    message: 'skillIds must not contain duplicates.',
    path: ['skillIds'],
  });
export type ReplaceProviderSkillsBody = z.infer<typeof replaceProviderSkillsBodySchema>;
