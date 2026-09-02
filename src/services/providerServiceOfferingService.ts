import type { DbPool } from '../db/pool.js';
import type { ServicesClient } from '../clients/servicesClient.js';
import {
  deleteProviderServiceByServiceId,
  findProviderServiceByServiceId,
  insertProviderService,
  listProviderServices as listProviderServicesQuery,
  updateProviderServiceByServiceId,
} from '../db/queries/providerServices.js';
import { isUniqueViolation } from '../errors/dbErrors.js';
import { AppError } from '../errors/AppError.js';
import { ErrorCode } from '../errors/errorCodes.js';
import type { ProviderService } from '../domain/types.js';
import type { CreateProviderServiceBody, UpdateProviderServiceBody } from '../schemas/providerServices.js';

function notFoundError(): AppError {
  return new AppError({ statusCode: 404, code: ErrorCode.SERVICE_OFFERING_NOT_FOUND, message: 'Service offering not found.' });
}

function toAmountString(amount: number | null | undefined): string | null {
  return amount == null ? null : amount.toFixed(2);
}

/**
 * Validates the referenced service_id against servora-services before a
 * provider can offer it — this is the only place this service ever calls
 * out to servora-services (see clients/servicesClient.ts) — and translates
 * every upstream failure mode (not found, inactive, unavailable, timeout,
 * malformed response) into a clear domain error rather than letting a
 * network exception leak to the caller.
 */
async function assertServiceIsOfferable(servicesClient: ServicesClient, serviceId: string, requestId: string): Promise<void> {
  const service = await servicesClient.getServiceById(serviceId, requestId);
  if (!service) {
    throw new AppError({
      statusCode: 400,
      code: ErrorCode.UPSTREAM_SERVICE_NOT_FOUND,
      message: 'serviceId does not reference an existing, publicly available service.',
    });
  }
  if (service.status !== 'ACTIVE') {
    throw new AppError({
      statusCode: 400,
      code: ErrorCode.UPSTREAM_SERVICE_INACTIVE,
      message: 'This service is not currently active and cannot be offered.',
    });
  }
}

export async function createProviderServiceOffering(
  pool: DbPool,
  servicesClient: ServicesClient,
  providerId: string,
  body: CreateProviderServiceBody,
  requestId: string,
): Promise<ProviderService> {
  await assertServiceIsOfferable(servicesClient, body.serviceId, requestId);

  try {
    return await insertProviderService(pool, {
      providerId,
      serviceId: body.serviceId,
      isEnabled: body.isEnabled,
      priceAmount: toAmountString(body.priceAmount),
      priceCurrency: body.priceCurrency ?? null,
      experienceYears: body.experienceYears ?? null,
      notes: body.notes ?? null,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError({
        statusCode: 409,
        code: ErrorCode.SERVICE_OFFERING_ALREADY_EXISTS,
        message: 'This provider already offers this service.',
      });
    }
    throw error;
  }
}

export async function listProviderServiceOfferings(pool: DbPool, providerId: string, includeDisabled: boolean): Promise<ProviderService[]> {
  return listProviderServicesQuery(pool, providerId, includeDisabled);
}

export async function updateProviderServiceOffering(
  pool: DbPool,
  providerId: string,
  serviceId: string,
  patch: UpdateProviderServiceBody,
): Promise<ProviderService> {
  const existing = await findProviderServiceByServiceId(pool, providerId, serviceId);
  if (!existing) {
    throw notFoundError();
  }

  const updated = await updateProviderServiceByServiceId(pool, providerId, serviceId, {
    isEnabled: patch.isEnabled,
    priceAmount: patch.priceAmount === undefined ? undefined : toAmountString(patch.priceAmount),
    priceCurrency: patch.priceCurrency,
    experienceYears: patch.experienceYears,
    notes: patch.notes,
  });
  if (!updated) {
    throw notFoundError();
  }
  return updated;
}

export async function deleteProviderServiceOffering(pool: DbPool, providerId: string, serviceId: string): Promise<void> {
  const deleted = await deleteProviderServiceByServiceId(pool, providerId, serviceId);
  if (!deleted) {
    throw notFoundError();
  }
}
