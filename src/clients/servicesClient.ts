import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import { AppError } from '../errors/AppError.js';
import { ErrorCode } from '../errors/errorCodes.js';

/**
 * Client for the read-only servora-services contract this service depends
 * on: "does this service_id exist, and is it usable?" All HTTP calls to
 * servora-services are isolated behind this module — nothing else in this
 * codebase makes an outbound HTTP request, so the integration can be
 * mocked in tests and changed in one place if the upstream contract moves.
 *
 * Called directly against servora-services' own base URL (its `/api/v1/
 * services/catalog/:idOrSlug` read endpoint is public/unauthenticated), not
 * through the API Gateway — this is a server-to-server read, not a
 * request on behalf of an end user.
 */
const upstreamServiceSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']),
  bookingMode: z.enum(['INSTANT_ACCEPT', 'PROVIDER_SELECTION', 'QUOTE']),
});

export type UpstreamService = z.infer<typeof upstreamServiceSchema>;

export interface ServicesClientOptions {
  baseUrl: string;
  timeoutMs: number;
  logger: FastifyBaseLogger;
}

export interface ServicesClient {
  /** Resolves to undefined when the service does not exist (404 upstream). */
  getServiceById(serviceId: string, requestId: string): Promise<UpstreamService | undefined>;
}

const FALLBACK_SERVICES_BASE_URL = 'https://servora-services.onrender.com';

export class HttpServicesClient implements ServicesClient {
  constructor(private readonly options: ServicesClientOptions) {}

  async getServiceById(serviceId: string, requestId: string): Promise<UpstreamService | undefined> {
    const { baseUrl, timeoutMs, logger } = this.options;
    const candidates = [baseUrl];
    if (baseUrl !== FALLBACK_SERVICES_BASE_URL) {
      candidates.push(FALLBACK_SERVICES_BASE_URL);
    }

    let lastError: unknown;

    for (const targetBaseUrl of candidates) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${targetBaseUrl}/api/v1/services/catalog/${serviceId}`, {
          method: 'GET',
          headers: { 'x-request-id': requestId },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.status === 404) {
          return undefined;
        }

        if (!response.ok) {
          logger.warn({ serviceId, status: response.status, targetBaseUrl }, 'servora-services returned an unexpected status');
          if (candidates.indexOf(targetBaseUrl) < candidates.length - 1) {
            continue;
          }
          throw new AppError({
            statusCode: 502,
            code: ErrorCode.UPSTREAM_SERVICE_UNAVAILABLE,
            message: 'The service catalog is currently unavailable. Please try again.',
          });
        }

        const rawBody: unknown = await response.json().catch(() => undefined);
        const parsed = upstreamServiceSchema.safeParse(rawBody);
        if (!parsed.success) {
          logger.warn({ serviceId, issues: parsed.error.issues, targetBaseUrl }, 'servora-services returned a malformed response body');
          throw new AppError({
            statusCode: 502,
            code: ErrorCode.UPSTREAM_SERVICE_UNAVAILABLE,
            message: 'The service catalog returned an unexpected response. Please try again.',
          });
        }

        return parsed.data;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
        if (error instanceof AppError) throw error;

        const isAbort = error instanceof Error && error.name === 'AbortError';
        logger.warn({ err: error, serviceId, timedOut: isAbort, targetBaseUrl }, 'servora-services request failed');

        if (isAbort) {
          throw new AppError({
            statusCode: 504,
            code: ErrorCode.UPSTREAM_SERVICE_TIMEOUT,
            message: 'The service catalog did not respond in time. Please try again.',
            cause: error,
          });
        }

        if (candidates.indexOf(targetBaseUrl) < candidates.length - 1) {
          continue;
        }

        throw new AppError({
          statusCode: 502,
          code: ErrorCode.UPSTREAM_SERVICE_UNAVAILABLE,
          message: 'The service catalog is currently unavailable. Please try again.',
          cause: error,
        });
      }
    }

    throw new AppError({
      statusCode: 502,
      code: ErrorCode.UPSTREAM_SERVICE_UNAVAILABLE,
      message: 'The service catalog is currently unavailable. Please try again.',
      cause: lastError,
    });
  }
}
