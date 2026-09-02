import { z } from 'zod';
import { countryCodeSchema, uuidSchema } from './common.js';

const city = z.string().trim().min(1).max(150);
const region = z.string().trim().min(1).max(150);
const postalCode = z.string().trim().min(1).max(20);
const latitude = z.number().gte(-90).lte(90);
const longitude = z.number().gte(-180).lte(180);
const radiusKm = z.number().positive().max(1000);

export const createServiceAreaBodySchema = z
  .object({
    countryCode: countryCodeSchema,
    region: region.optional(),
    city,
    postalCode: postalCode.optional(),
    latitude: latitude.optional(),
    longitude: longitude.optional(),
    radiusKm: radiusKm.optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.radiusKm !== undefined && (body.latitude === undefined || body.longitude === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'radiusKm requires both latitude and longitude to be set.',
        path: ['radiusKm'],
      });
    }
    if ((body.latitude === undefined) !== (body.longitude === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'latitude and longitude must be set together.',
        path: ['longitude'],
      });
    }
  });
export type CreateServiceAreaBody = z.infer<typeof createServiceAreaBodySchema>;

export const serviceAreaIdParamSchema = z.object({
  id: uuidSchema,
});
