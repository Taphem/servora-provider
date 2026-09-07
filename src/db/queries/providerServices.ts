import type { DbPool } from '../pool.js';
import { mapProviderServiceRow } from '../rowMappers.js';
import type { ProviderService } from '../../domain/types.js';

export interface InsertProviderServiceParams {
  providerId: string;
  serviceId: string;
  isEnabled: boolean;
  priceAmount: string | null;
  priceCurrency: string | null;
  experienceYears: number | null;
  notes: string | null;
}

export async function insertProviderService(pool: DbPool, params: InsertProviderServiceParams): Promise<ProviderService> {
  const result = await pool.query(
    `INSERT INTO provider_services (
       provider_id, service_id, is_enabled, price_amount, price_currency, experience_years, notes
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      params.providerId,
      params.serviceId,
      params.isEnabled,
      params.priceAmount,
      params.priceCurrency,
      params.experienceYears,
      params.notes,
    ],
  );
  return mapProviderServiceRow(result.rows[0]);
}

export async function findProviderServiceByServiceId(
  pool: DbPool,
  providerId: string,
  serviceId: string,
): Promise<ProviderService | undefined> {
  const result = await pool.query(
    'SELECT * FROM provider_services WHERE provider_id = $1 AND (service_id = $2 OR id = $2)',
    [providerId, serviceId],
  );
  return result.rows[0] ? mapProviderServiceRow(result.rows[0]) : undefined;
}

export async function listProviderServices(
  pool: DbPool,
  providerId: string,
  includeDisabled: boolean,
): Promise<ProviderService[]> {
  const whereClause = includeDisabled ? '' : 'AND is_enabled';
  const result = await pool.query(
    `SELECT * FROM provider_services WHERE provider_id = $1 ${whereClause} ORDER BY created_at ASC`,
    [providerId],
  );
  return result.rows.map(mapProviderServiceRow);
}

export async function countEnabledProviderServices(pool: DbPool, providerId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    'SELECT count(*) FROM provider_services WHERE provider_id = $1 AND is_enabled',
    [providerId],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export interface UpdateProviderServiceParams {
  isEnabled?: boolean;
  priceAmount?: string | null;
  priceCurrency?: string | null;
  experienceYears?: number | null;
  notes?: string | null;
}

const COLUMN_BY_FIELD: Record<keyof UpdateProviderServiceParams, string> = {
  isEnabled: 'is_enabled',
  priceAmount: 'price_amount',
  priceCurrency: 'price_currency',
  experienceYears: 'experience_years',
  notes: 'notes',
};

export async function updateProviderServiceByServiceId(
  pool: DbPool,
  providerId: string,
  serviceId: string,
  patch: UpdateProviderServiceParams,
): Promise<ProviderService | undefined> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  for (const [field, column] of Object.entries(COLUMN_BY_FIELD) as [keyof UpdateProviderServiceParams, string][]) {
    if (patch[field] !== undefined) {
      setClauses.push(`${column} = $${i++}`);
      values.push(patch[field]);
    }
  }

  if (setClauses.length === 0) {
    return findProviderServiceByServiceId(pool, providerId, serviceId);
  }

  setClauses.push('updated_at = now()');
  values.push(providerId, serviceId);

  const result = await pool.query(
    `UPDATE provider_services SET ${setClauses.join(', ')} WHERE provider_id = $${i++} AND (service_id = $${i} OR id = $${i}) RETURNING *`,
    values,
  );
  return result.rows[0] ? mapProviderServiceRow(result.rows[0]) : undefined;
}

export async function deleteProviderServiceByServiceId(pool: DbPool, providerId: string, serviceId: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM provider_services WHERE provider_id = $1 AND (service_id = $2 OR id = $2)',
    [providerId, serviceId],
  );
  return (result.rowCount ?? 0) > 0;
}
