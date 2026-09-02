import { z } from 'zod';
import { languageCodeSchema, slugSchema, timezoneSchema } from './common.js';

const displayName = z.string().trim().min(2).max(150);
const bio = z.string().trim().min(1).max(2000);
const profilePhotoUrl = z.string().trim().url().max(2048);
const yearsExperience = z.number().int().min(0).max(100);
const businessName = z.string().trim().min(1).max(200);
const languages = z.array(languageCodeSchema).max(20);

export const createProviderBodySchema = z
  .object({
    displayName,
    slug: slugSchema.optional(),
    bio: bio.optional(),
    profilePhotoUrl: profilePhotoUrl.optional(),
    yearsExperience: yearsExperience.optional(),
    businessName: businessName.optional(),
    languages: languages.default([]),
    timezone: timezoneSchema.default('UTC'),
  })
  .strict();
export type CreateProviderBody = z.infer<typeof createProviderBodySchema>;

export const updateProviderBodySchema = z
  .object({
    displayName: displayName.optional(),
    slug: slugSchema.optional(),
    bio: bio.nullable().optional(),
    profilePhotoUrl: profilePhotoUrl.nullable().optional(),
    yearsExperience: yearsExperience.nullable().optional(),
    businessName: businessName.nullable().optional(),
    languages: languages.optional(),
    timezone: timezoneSchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field must be provided.' });
export type UpdateProviderBody = z.infer<typeof updateProviderBodySchema>;

export function buildListProvidersQuerySchema(defaultPageSize: number, maxPageSize: number) {
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(maxPageSize).default(defaultPageSize),
    serviceId: z.string().uuid().optional(),
    skillId: z.string().uuid().optional(),
    city: z.string().trim().min(1).max(150).optional(),
    countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional(),
  });
}

export const adminSetStatusBodySchema = z
  .object({
    status: z.enum(['PENDING_ONBOARDING', 'ACTIVE', 'PAUSED', 'DISABLED']),
    reason: z.string().trim().min(1).max(1000).optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.status === 'DISABLED' && !body.reason) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'reason is required when disabling a provider.', path: ['reason'] });
    }
  });
export type AdminSetStatusBody = z.infer<typeof adminSetStatusBodySchema>;

export const adminSetVerificationBodySchema = z
  .object({
    verificationStatus: z.enum(['VERIFIED', 'REJECTED']),
    notes: z.string().trim().min(1).max(2000).optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.verificationStatus === 'REJECTED' && !body.notes) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'notes is required when rejecting verification.', path: ['notes'] });
    }
  });
export type AdminSetVerificationBody = z.infer<typeof adminSetVerificationBodySchema>;

export function buildAdminListProvidersQuerySchema(defaultPageSize: number, maxPageSize: number) {
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(maxPageSize).default(defaultPageSize),
    status: z.enum(['PENDING_ONBOARDING', 'ACTIVE', 'PAUSED', 'DISABLED']).optional(),
    verificationStatus: z.enum(['UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED']).optional(),
  });
}
