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

export class HttpServicesClient implements ServicesClient {
  constructor(private readonly options: ServicesClientOptions) {}

  async getServiceById(serviceId: string, requestId: string): Promise<UpstreamService | undefined> {
    const { baseUrl, timeoutMs, logger } = this.options;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/v1/services/catalog/${serviceId}`, {
        method: 'GET',
        headers: { 'x-request-id': requestId },
        signal: controller.signal,
      });
    } catch (error) {
      const isAbort = error instanceof Error && error.name === 'AbortError';
      logger.warn({ err: error, serviceId, timedOut: isAbort }, 'servora-services request failed');
      throw new AppError({
        statusCode: isAbort ? 504 : 502,
        code: isAbort ? ErrorCode.UPSTREAM_SERVICE_TIMEOUT : ErrorCode.UPSTREAM_SERVICE_UNAVAILABLE,
        message: isAbort
          ? 'The service catalog did not respond in time. Please try again.'
          : 'The service catalog is currently unavailable. Please try again.',
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 404) {
      return undefined;
    }

    if (!response.ok) {
      logger.warn({ serviceId, status: response.status }, 'servora-services returned an unexpected status');
      throw new AppError({
        statusCode: 502,
        code: ErrorCode.UPSTREAM_SERVICE_UNAVAILABLE,
        message: 'The service catalog is currently unavailable. Please try again.',
      });
    }

    const rawBody: unknown = await response.json().catch(() => undefined);
    const parsed = upstreamServiceSchema.safeParse(rawBody);
    if (!parsed.success) {
      logger.warn({ serviceId, issues: parsed.error.issues }, 'servora-services returned a malformed response body');
      throw new AppError({
        statusCode: 502,
        code: ErrorCode.UPSTREAM_SERVICE_UNAVAILABLE,
        message: 'The service catalog returned an unexpected response. Please try again.',
      });
    }

    return parsed.data;
  }
}
