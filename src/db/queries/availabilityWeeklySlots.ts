import type { DbPool } from '../pool.js';
import { mapWeeklyAvailabilitySlotRow } from '../rowMappers.js';
import type { WeeklyAvailabilitySlot } from '../../domain/types.js';

export async function listWeeklySlotsForProvider(pool: DbPool, providerId: string): Promise<WeeklyAvailabilitySlot[]> {
  const result = await pool.query(
    'SELECT * FROM availability_weekly_slots WHERE provider_id = $1 ORDER BY day_of_week ASC, start_time ASC',
    [providerId],
  );
  return result.rows.map(mapWeeklyAvailabilitySlotRow);
}

export interface WeeklySlotInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

/**
 * Replaces a provider's entire weekly schedule atomically, the same
 * full-array-replace pattern used for skills and (in servora-services) for
 * requirement fields — a schedule edit is one coherent change, not
 * slot-by-slot CRUD that could leave a half-edited week visible mid-edit.
 * The DB's EXCLUDE constraint (see migrations/0001_init.sql) is still the
 * authoritative overlap guard; this only fails fast with a clearer error.
 */
export async function replaceWeeklySlots(pool: DbPool, providerId: string, slots: WeeklySlotInput[]): Promise<WeeklyAvailabilitySlot[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM availability_weekly_slots WHERE provider_id = $1', [providerId]);

    const inserted: WeeklyAvailabilitySlot[] = [];
    for (const slot of slots) {
      const result = await client.query(
        `INSERT INTO availability_weekly_slots (provider_id, day_of_week, start_time, end_time)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [providerId, slot.dayOfWeek, slot.startTime, slot.endTime],
      );
      inserted.push(mapWeeklyAvailabilitySlotRow(result.rows[0]));
    }

    await client.query('COMMIT');
    return inserted.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
