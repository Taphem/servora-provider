import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Env } from '../config/env.js';

export interface RequestIdentity {
  userId: string;
  role: string;
}

/**
 * Platform-wide roles as issued by servora-auth (see its
 * src/types/domain.ts UserRole enum: CUSTOMER, BUSINESS_OWNER,
 * BUSINESS_STAFF, ADMIN, SUPER_ADMIN, SUPPORT). This service does not
 * invent its own role system.
 *
 * servora-docs/01-product/user-roles.md describes a conceptual "PROVIDER"
 * role ("a service professional/business that offers services through
 * Servora"), but servora-auth's actually-implemented UserRole enum has no
 * such value — the role it issues for a service-offering account is
 * BUSINESS_OWNER (with BUSINESS_STAFF for staff of that business). Rather
 * than invent a PROVIDER role that the identity provider would never
 * actually send, this service treats BUSINESS_OWNER as the role that may
 * self-manage a provider profile. See README "Authorization" for the fuller
 * rationale and the BUSINESS_STAFF limitation.
 */
export const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);
export const PROVIDER_ROLES = new Set(['BUSINESS_OWNER']);

export function isAdminIdentity(identity: RequestIdentity | undefined): boolean {
  return identity !== undefined && ADMIN_ROLES.has(identity.role);
}

export function isProviderIdentity(identity: RequestIdentity | undefined): boolean {
  return identity !== undefined && PROVIDER_ROLES.has(identity.role);
}

function headerValue(request: FastifyRequest, header: string): string | undefined {
  const value = request.headers[header.toLowerCase()];
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && candidate.length > 0 ? candidate : undefined;
}

export interface IdentityPluginOptions {
  userIdHeader: Env['USER_ID_HEADER'];
  userRoleHeader: Env['USER_ROLE_HEADER'];
}

/**
 * Attaches request.identity when the API Gateway has already verified the
 * caller's session and forwarded the resolved identity headers (see
 * servora-api-gateway/src/routes/v1/proxy.ts buildForwardHeaders). This
 * service never verifies a session token itself and never decodes a JWT —
 * it trusts these headers exactly as every other downstream service the
 * gateway proxies to does. Requests reaching this service directly
 * (bypassing the gateway) are outside this service's trust boundary, the
 * same as the rest of the current Servora architecture.
 */
export default fp<IdentityPluginOptions>(async (app: FastifyInstance, opts: IdentityPluginOptions) => {
  app.addHook('onRequest', async (request) => {
    const userId = headerValue(request, opts.userIdHeader);
    const role = headerValue(request, opts.userRoleHeader);
    if (userId && role) {
      request.identity = { userId, role };
    }
  });
});
