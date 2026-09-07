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

/**
 * Self-service skill creation for a BUSINESS_OWNER — deliberately just a
 * name. Unlike createSkillBodySchema (admin-only), a provider never
 * chooses a slug or status directly: the slug is always derived
 * server-side and every self-created skill starts ACTIVE, exactly like an
 * admin-created one. This reuses the existing `skills` table as-is (no new
 * columns, no provider-ownership concept on the row) — see
 * skillService.createOrFindSkillByName.
 */
export const createProviderSkillBodySchema = z
  .object({
    name: z.string().trim().min(2).max(150),
  })
  .strict();
export type CreateProviderSkillBody = z.infer<typeof createProviderSkillBodySchema>;

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
