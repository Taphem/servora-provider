import { describe, expect, it } from 'vitest';
import { replaceWeeklyAvailabilityBodySchema, upsertAvailabilityOverrideBodySchema } from '../../src/schemas/availability.js';

describe('replaceWeeklyAvailabilityBodySchema', () => {
  it('accepts non-overlapping slots across different days', () => {
    const result = replaceWeeklyAvailabilityBodySchema.safeParse({
      slots: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
        { dayOfWeek: 2, startTime: '09:00', endTime: '17:00' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects two overlapping slots on the same day', () => {
    const result = replaceWeeklyAvailabilityBodySchema.safeParse({
      slots: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
        { dayOfWeek: 1, startTime: '12:00', endTime: '17:00' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a malformed time string', () => {
    const result = replaceWeeklyAvailabilityBodySchema.safeParse({
      slots: [{ dayOfWeek: 1, startTime: '25:00', endTime: '17:00' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('upsertAvailabilityOverrideBodySchema', () => {
  it('accepts isUnavailable=true with no times', () => {
    expect(upsertAvailabilityOverrideBodySchema.safeParse({ isUnavailable: true }).success).toBe(true);
  });

  it('rejects isUnavailable=true with times set', () => {
    expect(
      upsertAvailabilityOverrideBodySchema.safeParse({ isUnavailable: true, startTime: '09:00', endTime: '10:00' }).success,
    ).toBe(false);
  });

  it('rejects isUnavailable=false without times', () => {
    expect(upsertAvailabilityOverrideBodySchema.safeParse({ isUnavailable: false }).success).toBe(false);
  });

  it('accepts isUnavailable=false with a valid time range', () => {
    expect(
      upsertAvailabilityOverrideBodySchema.safeParse({ isUnavailable: false, startTime: '09:00', endTime: '10:00' }).success,
    ).toBe(true);
  });
});
