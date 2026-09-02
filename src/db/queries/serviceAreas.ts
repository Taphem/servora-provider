import type { DbPool } from '../pool.js';
import { mapServiceAreaRow } from '../rowMappers.js';
import type { ServiceArea } from '../../domain/types.js';

export interface InsertServiceAreaParams {
  providerId: string;
  countryCode: string;
  region: string | null;
  city: string;
  postalCode: string | null;
  latitude: string | null;
  longitude: string | null;
  radiusKm: string | null;
}

export async function insertServiceArea(pool: DbPool, params: InsertServiceAreaParams): Promise<ServiceArea> {
  const result = await pool.query(
    `INSERT INTO service_areas (provider_id, country_code, region, city, postal_code, latitude, longitude, radius_km)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      params.providerId,
      params.countryCode,
      params.region,
      params.city,
      params.postalCode,
      params.latitude,
      params.longitude,
      params.radiusKm,
    ],
  );
  return mapServiceAreaRow(result.rows[0]);
}

export async function listServiceAreasForProvider(pool: DbPool, providerId: string): Promise<ServiceArea[]> {
  const result = await pool.query('SELECT * FROM service_areas WHERE provider_id = $1 ORDER BY city ASC, created_at ASC', [
    providerId,
  ]);
  return result.rows.map(mapServiceAreaRow);
}

export async function countServiceAreasForProvider(pool: DbPool, providerId: string): Promise<number> {
  const result = await pool.query<{ count: string }>('SELECT count(*) FROM service_areas WHERE provider_id = $1', [providerId]);
  return Number(result.rows[0]?.count ?? 0);
}

export async function findServiceAreaById(pool: DbPool, providerId: string, id: string): Promise<ServiceArea | undefined> {
  const result = await pool.query('SELECT * FROM service_areas WHERE provider_id = $1 AND id = $2', [providerId, id]);
  return result.rows[0] ? mapServiceAreaRow(result.rows[0]) : undefined;
}

export async function deleteServiceArea(pool: DbPool, providerId: string, id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM service_areas WHERE provider_id = $1 AND id = $2', [providerId, id]);
  return (result.rowCount ?? 0) > 0;
}
