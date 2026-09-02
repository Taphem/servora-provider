import type { DbPool } from '../pool.js';
import { mapAvailabilityDateOverrideRow } from '../rowMappers.js';
import type { AvailabilityDateOverride } from '../../domain/types.js';

export interface UpsertOverrideParams {
  providerId: string;
  overrideDate: string;
  isUnavailable: boolean;
  startTime: string | null;
  endTime: string | null;
}

export async function upsertAvailabilityOverride(pool: DbPool, params: UpsertOverrideParams): Promise<AvailabilityDateOverride> {
  const result = await pool.query(
    `INSERT INTO availability_date_overrides (provider_id, override_date, is_unavailable, start_time, end_time)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (provider_id, override_date)
     DO UPDATE SET is_unavailable = EXCLUDED.is_unavailable, start_time = EXCLUDED.start_time,
                   end_time = EXCLUDED.end_time, updated_at = now()
     RETURNING *`,
    [params.providerId, params.overrideDate, params.isUnavailable, params.startTime, params.endTime],
  );
  return mapAvailabilityDateOverrideRow(result.rows[0]);
}

export interface ListOverridesFilter {
  from?: string;
  to?: string;
}

export async function listAvailabilityOverrides(
  pool: DbPool,
  providerId: string,
  filter: ListOverridesFilter,
): Promise<AvailabilityDateOverride[]> {
  const conditions = ['provider_id = $1'];
  const values: unknown[] = [providerId];
  let i = 2;

  if (filter.from !== undefined) {
    conditions.push(`override_date >= $${i++}`);
    values.push(filter.from);
  }
  if (filter.to !== undefined) {
    conditions.push(`override_date <= $${i++}`);
    values.push(filter.to);
  }

  const result = await pool.query(
    `SELECT * FROM availability_date_overrides WHERE ${conditions.join(' AND ')} ORDER BY override_date ASC`,
    values,
  );
  return result.rows.map(mapAvailabilityDateOverrideRow);
}

export async function deleteAvailabilityOverride(pool: DbPool, providerId: string, overrideDate: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM availability_date_overrides WHERE provider_id = $1 AND override_date = $2', [
    providerId,
    overrideDate,
  ]);
  return (result.rowCount ?? 0) > 0;
}
