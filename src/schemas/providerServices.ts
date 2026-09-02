import { z } from 'zod';
import { currencyCodeSchema, uuidSchema } from './common.js';

// Stored as NUMERIC(12,2); kept as a plain finite number in the API and
// converted to a string only at the database boundary (see
// servora-services' identical convention in schemas/catalog.ts).
const priceAmount = z.number().finite().nonnegative().max(9_999_999_999.99);
const experienceYears = z.number().int().min(0).max(100);
const notes = z.string().trim().min(1).max(1000);

function checkPricePair(
  body: { priceAmount?: number | null; priceCurrency?: string | null },
  ctx: z.RefinementCtx,
): void {
  if ((body.priceAmount == null) !== (body.priceCurrency == null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'priceAmount and priceCurrency must be set together, or both omitted.',
      path: ['priceCurrency'],
    });
  }
}

export const createProviderServiceBodySchema = z
  .object({
    serviceId: uuidSchema,
    isEnabled: z.boolean().default(true),
    priceAmount: priceAmount.nullable().optional(),
    priceCurrency: currencyCodeSchema.nullable().optional(),
    experienceYears: experienceYears.nullable().optional(),
    notes: notes.nullable().optional(),
  })
  .strict()
  .superRefine(checkPricePair);
export type CreateProviderServiceBody = z.infer<typeof createProviderServiceBodySchema>;

export const updateProviderServiceBodySchema = z
  .object({
    isEnabled: z.boolean().optional(),
    priceAmount: priceAmount.nullable().optional(),
    priceCurrency: currencyCodeSchema.nullable().optional(),
    experienceYears: experienceYears.nullable().optional(),
    notes: notes.nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field must be provided.' })
  .superRefine((body, ctx) => {
    if (body.priceAmount !== undefined || body.priceCurrency !== undefined) {
      checkPricePair(body, ctx);
    }
  });
export type UpdateProviderServiceBody = z.infer<typeof updateProviderServiceBodySchema>;

export const providerServiceIdParamSchema = z.object({
  serviceId: uuidSchema,
});
