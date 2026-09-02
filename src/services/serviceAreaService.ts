import type { DbPool } from '../db/pool.js';
import { deleteServiceArea, findServiceAreaById, insertServiceArea, listServiceAreasForProvider } from '../db/queries/serviceAreas.js';
import { isUniqueViolation } from '../errors/dbErrors.js';
import { AppError } from '../errors/AppError.js';
import { ErrorCode } from '../errors/errorCodes.js';
import type { ServiceArea } from '../domain/types.js';
import type { CreateServiceAreaBody } from '../schemas/serviceAreas.js';

function toDecimalString(value: number | undefined, digits: number): string | null {
  return value === undefined ? null : value.toFixed(digits);
}

export async function createServiceArea(pool: DbPool, providerId: string, body: CreateServiceAreaBody): Promise<ServiceArea> {
  try {
    return await insertServiceArea(pool, {
      providerId,
      countryCode: body.countryCode,
      region: body.region ?? null,
      city: body.city,
      postalCode: body.postalCode ?? null,
      latitude: toDecimalString(body.latitude, 6),
      longitude: toDecimalString(body.longitude, 6),
      radiusKm: toDecimalString(body.radiusKm, 2),
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError({
        statusCode: 409,
        code: ErrorCode.SERVICE_AREA_ALREADY_EXISTS,
        message: 'This provider already has a matching service area.',
      });
    }
    throw error;
  }
}

export async function listServiceAreas(pool: DbPool, providerId: string): Promise<ServiceArea[]> {
  return listServiceAreasForProvider(pool, providerId);
}

export async function removeServiceArea(pool: DbPool, providerId: string, id: string): Promise<void> {
  const existing = await findServiceAreaById(pool, providerId, id);
  if (!existing) {
    throw new AppError({ statusCode: 404, code: ErrorCode.SERVICE_AREA_NOT_FOUND, message: 'Service area not found.' });
  }
  await deleteServiceArea(pool, providerId, id);
}
