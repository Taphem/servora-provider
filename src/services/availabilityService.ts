import type { DbPool } from '../db/pool.js';
import { listWeeklySlotsForProvider, replaceWeeklySlots } from '../db/queries/availabilityWeeklySlots.js';
import {
  deleteAvailabilityOverride,
  listAvailabilityOverrides,
  upsertAvailabilityOverride,
} from '../db/queries/availabilityDateOverrides.js';
import { isExclusionViolation } from '../errors/dbErrors.js';
import { AppError } from '../errors/AppError.js';
import { ErrorCode } from '../errors/errorCodes.js';
import type { AvailabilityDateOverride, WeeklyAvailabilitySlot } from '../domain/types.js';
import type { ReplaceWeeklyAvailabilityBody, UpsertAvailabilityOverrideBody } from '../schemas/availability.js';

export async function getWeeklyAvailability(pool: DbPool, providerId: string): Promise<WeeklyAvailabilitySlot[]> {
  return listWeeklySlotsForProvider(pool, providerId);
}

export async function replaceWeeklyAvailability(
  pool: DbPool,
  providerId: string,
  body: ReplaceWeeklyAvailabilityBody,
): Promise<WeeklyAvailabilitySlot[]> {
  try {
    return await replaceWeeklySlots(pool, providerId, body.slots);
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new AppError({
        statusCode: 409,
        code: ErrorCode.AVAILABILITY_SLOT_OVERLAP,
        message: 'Two or more slots on the same day overlap.',
      });
    }
    throw error;
  }
}

export async function listOverrides(pool: DbPool, providerId: string, from?: string, to?: string): Promise<AvailabilityDateOverride[]> {
  return listAvailabilityOverrides(pool, providerId, { from, to });
}

export async function upsertOverride(
  pool: DbPool,
  providerId: string,
  date: string,
  body: UpsertAvailabilityOverrideBody,
): Promise<AvailabilityDateOverride> {
  return upsertAvailabilityOverride(pool, {
    providerId,
    overrideDate: date,
    isUnavailable: body.isUnavailable,
    startTime: body.startTime ?? null,
    endTime: body.endTime ?? null,
  });
}

export async function removeOverride(pool: DbPool, providerId: string, date: string): Promise<void> {
  const deleted = await deleteAvailabilityOverride(pool, providerId, date);
  if (!deleted) {
    throw new AppError({ statusCode: 404, code: ErrorCode.AVAILABILITY_OVERRIDE_NOT_FOUND, message: 'No override exists for this date.' });
  }
}
