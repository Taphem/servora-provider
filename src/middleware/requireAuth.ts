import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../errors/AppError.js';
import { ErrorCode } from '../errors/errorCodes.js';
import { isAdminIdentity, isProviderIdentity } from './identity.js';

/** preHandler guard for provider self-service (write) routes under /providers/me. */
export async function requireProvider(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!request.identity) {
    throw new AppError({
      statusCode: 401,
      code: ErrorCode.UNAUTHENTICATED,
      message: 'Authentication is required for this operation.',
    });
  }

  if (!isProviderIdentity(request.identity)) {
    throw new AppError({
      statusCode: 403,
      code: ErrorCode.FORBIDDEN,
      message: 'This operation requires a provider (BUSINESS_OWNER) identity.',
    });
  }
}

/** preHandler guard for administrative management routes under /providers/admin. */
export async function requireAdmin(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!request.identity) {
    throw new AppError({
      statusCode: 401,
      code: ErrorCode.UNAUTHENTICATED,
      message: 'Authentication is required for this operation.',
    });
  }

  if (!isAdminIdentity(request.identity)) {
    throw new AppError({
      statusCode: 403,
      code: ErrorCode.FORBIDDEN,
      message: 'This operation requires an administrator role.',
    });
  }
}
