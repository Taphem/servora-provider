import type { DbPool } from '../db/pool.js';
import type { Cache } from '../cache/Cache.js';
import {
  findProviderById,
  findProviderBySlug,
  findProviderByUserId,
  insertProvider,
  listProviders as listProvidersQuery,
  updateProvider as updateProviderQuery,
  type ListProvidersFilter,
} from '../db/queries/providers.js';
import { countEnabledProviderServices } from '../db/queries/providerServices.js';
import { countServiceAreasForProvider } from '../db/queries/serviceAreas.js';
import { isUniqueViolation } from '../errors/dbErrors.js';
import { AppError } from '../errors/AppError.js';
import { ErrorCode } from '../errors/errorCodes.js';
import { ProviderStatus, VerificationStatus, type Provider } from '../domain/types.js';
import { assertCanSubmitForVerification, assertValidStatusTransition, assertValidVerificationDecision, type StatusActor } from '../domain/lifecycle.js';
import { computeEligibility, type EligibilityResult } from '../domain/eligibility.js';
import { buildPage, paginationOffset, type Page } from '../utils/pagination.js';
import { isUuid } from '../schemas/common.js';
import { slugify } from '../utils/slugify.js';
import type { CreateProviderBody, UpdateProviderBody } from '../schemas/providers.js';

const CACHE_KEY_PREFIX = 'provider:public:';

function notFoundError(): AppError {
  return new AppError({ statusCode: 404, code: ErrorCode.PROVIDER_NOT_FOUND, message: 'Provider not found.' });
}

async function invalidatePublicCache(cache: Cache, provider: Pick<Provider, 'id' | 'slug'>): Promise<void> {
  await cache.del(CACHE_KEY_PREFIX + provider.id);
  await cache.del(CACHE_KEY_PREFIX + provider.slug);
}

export async function createProvider(pool: DbPool, userId: string, body: CreateProviderBody): Promise<Provider> {
  const existing = await findProviderByUserId(pool, userId);
  if (existing) {
    throw new AppError({
      statusCode: 409,
      code: ErrorCode.PROVIDER_ALREADY_EXISTS,
      message: 'A provider profile already exists for this account.',
    });
  }

  const slug = body.slug ?? slugify(body.displayName);
  try {
    return await insertProvider(pool, {
      userId,
      displayName: body.displayName,
      slug,
      bio: body.bio ?? null,
      profilePhotoUrl: body.profilePhotoUrl ?? null,
      yearsExperience: body.yearsExperience ?? null,
      businessName: body.businessName ?? null,
      languages: body.languages,
      timezone: body.timezone,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      if ((error as { constraint?: string }).constraint === 'providers_user_id_unique') {
        throw new AppError({
          statusCode: 409,
          code: ErrorCode.PROVIDER_ALREADY_EXISTS,
          message: 'A provider profile already exists for this account.',
        });
      }
      throw new AppError({
        statusCode: 409,
        code: ErrorCode.PROVIDER_SLUG_ALREADY_EXISTS,
        message: 'A provider with this slug already exists.',
      });
    }
    throw error;
  }
}

export async function requireProviderById(pool: DbPool, id: string): Promise<Provider> {
  const provider = await findProviderById(pool, id);
  if (!provider) {
    throw notFoundError();
  }
  return provider;
}

export async function requireProviderByUserId(pool: DbPool, userId: string): Promise<Provider> {
  const provider = await findProviderByUserId(pool, userId);
  if (!provider) {
    throw notFoundError();
  }
  return provider;
}

export async function getProviderByIdOrSlug(pool: DbPool, cache: Cache, idOrSlug: string, includeInactive: boolean): Promise<Provider> {
  const cacheKey = CACHE_KEY_PREFIX + idOrSlug;
  if (!includeInactive) {
    const cached = await cache.get<Provider>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const provider = isUuid(idOrSlug) ? await findProviderById(pool, idOrSlug) : await findProviderBySlug(pool, idOrSlug);
  if (!provider || (!includeInactive && provider.status !== ProviderStatus.ACTIVE)) {
    throw notFoundError();
  }

  if (!includeInactive) {
    await cache.set(cacheKey, provider, 60);
  }
  return provider;
}

export interface ListProvidersOptions extends Omit<ListProvidersFilter, 'status' | 'limit' | 'offset'> {
  status?: ListProvidersFilter['status'];
  includeAllStatuses: boolean;
  page: number;
  pageSize: number;
}

export async function listProviders(pool: DbPool, options: ListProvidersOptions): Promise<Page<Provider>> {
  const { rows, total } = await listProvidersQuery(pool, {
    status: options.includeAllStatuses ? options.status : (options.status ?? ProviderStatus.ACTIVE),
    verificationStatus: options.verificationStatus,
    city: options.city,
    countryCode: options.countryCode,
    serviceId: options.serviceId,
    skillId: options.skillId,
    limit: options.pageSize,
    offset: paginationOffset(options.page, options.pageSize),
  });
  return buildPage(rows, options.page, options.pageSize, total);
}

export async function updateProvider(pool: DbPool, cache: Cache, id: string, patch: UpdateProviderBody): Promise<Provider> {
  const existing = await requireProviderById(pool, id);

  try {
    const updated = await updateProviderQuery(pool, id, {
      displayName: patch.displayName,
      slug: patch.slug,
      bio: patch.bio,
      profilePhotoUrl: patch.profilePhotoUrl,
      yearsExperience: patch.yearsExperience,
      businessName: patch.businessName,
      languages: patch.languages,
      timezone: patch.timezone,
    });
    if (!updated) {
      throw notFoundError();
    }
    await invalidatePublicCache(cache, existing);
    await invalidatePublicCache(cache, updated);
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError({
        statusCode: 409,
        code: ErrorCode.PROVIDER_SLUG_ALREADY_EXISTS,
        message: 'A provider with this slug already exists.',
      });
    }
    throw error;
  }
}

export async function setProviderStatus(
  pool: DbPool,
  cache: Cache,
  id: string,
  target: ProviderStatus,
  actor: StatusActor,
  reason?: string,
): Promise<Provider> {
  const existing = await requireProviderById(pool, id);
  assertValidStatusTransition(existing.status, target, actor);

  const updated = await updateProviderQuery(pool, id, {
    status: target,
    disabledReason: target === ProviderStatus.DISABLED ? (reason ?? null) : null,
  });
  if (!updated) {
    throw notFoundError();
  }
  await invalidatePublicCache(cache, existing);
  return updated;
}

export async function submitProviderForVerification(pool: DbPool, cache: Cache, id: string): Promise<Provider> {
  const existing = await requireProviderById(pool, id);
  assertCanSubmitForVerification(existing.verificationStatus);

  const updated = await updateProviderQuery(pool, id, {
    verificationStatus: VerificationStatus.PENDING_REVIEW,
    verificationNotes: null,
  });
  if (!updated) {
    throw notFoundError();
  }
  await invalidatePublicCache(cache, existing);
  return updated;
}

export async function recordVerificationDecision(
  pool: DbPool,
  cache: Cache,
  id: string,
  decision: typeof VerificationStatus.VERIFIED | typeof VerificationStatus.REJECTED,
  reviewerUserId: string,
  notes?: string,
): Promise<Provider> {
  const existing = await requireProviderById(pool, id);
  assertValidVerificationDecision(existing.verificationStatus, decision);

  const updated = await updateProviderQuery(pool, id, {
    verificationStatus: decision,
    verificationNotes: notes ?? null,
    verificationReviewedBy: reviewerUserId,
    verificationReviewedAt: new Date(),
  });
  if (!updated) {
    throw notFoundError();
  }
  await invalidatePublicCache(cache, existing);
  return updated;
}

export async function getProviderEligibility(pool: DbPool, providerId: string): Promise<EligibilityResult> {
  const provider = await requireProviderById(pool, providerId);
  const [enabledOfferings, serviceAreas] = await Promise.all([
    countEnabledProviderServices(pool, providerId),
    countServiceAreasForProvider(pool, providerId),
  ]);

  return computeEligibility({
    provider,
    hasEnabledServiceOffering: enabledOfferings > 0,
    hasServiceArea: serviceAreas > 0,
  });
}
