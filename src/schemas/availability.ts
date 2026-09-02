import { z } from 'zod';
import { dateSchema, timeSchema } from './common.js';

const weeklySlotSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: timeSchema,
    endTime: timeSchema,
  })
  .strict()
  .refine((slot) => slot.startTime < slot.endTime, { message: 'startTime must be before endTime.', path: ['endTime'] });

export const replaceWeeklyAvailabilityBodySchema = z
  .object({
    slots: z.array(weeklySlotSchema).max(50),
  })
  .strict()
  .superRefine((body, ctx) => {
    // App-level overlap check gives a clear, field-scoped validation error;
    // the DB's EXCLUDE constraint (migrations/0001_init.sql) is still the
    // authoritative guard against a race between two concurrent replaces.
    const byDay = new Map<number, { startTime: string; endTime: string }[]>();
    body.slots.forEach((slot, index) => {
      const daySlots = byDay.get(slot.dayOfWeek) ?? [];
      for (const existing of daySlots) {
        if (slot.startTime < existing.endTime && existing.startTime < slot.endTime) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Slot overlaps another slot on the same day (dayOfWeek ${slot.dayOfWeek}).`,
            path: ['slots', index],
          });
        }
      }
      daySlots.push(slot);
      byDay.set(slot.dayOfWeek, daySlots);
    });
  });
export type ReplaceWeeklyAvailabilityBody = z.infer<typeof replaceWeeklyAvailabilityBodySchema>;

export const upsertAvailabilityOverrideBodySchema = z
  .object({
    isUnavailable: z.boolean().default(true),
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
  })
  .strict()
  .superRefine((body, ctx) => {
    if (body.isUnavailable) {
      if (body.startTime !== undefined || body.endTime !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'startTime/endTime must not be set when isUnavailable is true.',
          path: ['startTime'],
        });
      }
      return;
    }
    if (body.startTime === undefined || body.endTime === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startTime and endTime are required when isUnavailable is false.',
        path: ['startTime'],
      });
      return;
    }
    if (body.startTime >= body.endTime) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'startTime must be before endTime.', path: ['endTime'] });
    }
  });
export type UpsertAvailabilityOverrideBody = z.infer<typeof upsertAvailabilityOverrideBodySchema>;

export const overrideDateParamSchema = z.object({
  date: dateSchema,
});

export const listOverridesQuerySchema = z
  .object({
    from: dateSchema.optional(),
    to: dateSchema.optional(),
  })
  .strict()
  .refine((query) => query.from === undefined || query.to === undefined || query.from <= query.to, {
    message: 'from must be less than or equal to to.',
    path: ['to'],
  });
export type ListOverridesQuery = z.infer<typeof listOverridesQuerySchema>;
