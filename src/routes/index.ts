import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../app/context.js';
import { registerGetProviderRoute, registerListProvidersRoute } from './v1/providers/list.js';
import { registerPublicProviderSubResourceRoutes } from './v1/providers/publicSubResources.js';
import { registerSkillsCatalogRoute } from './v1/providers/skillsCatalog.js';
import { registerMyProviderProfileRoutes } from './v1/providers/me/profile.js';
import { registerMyProviderLifecycleRoutes } from './v1/providers/me/lifecycle.js';
import { registerMyProviderServicesRoutes } from './v1/providers/me/services.js';
import { registerMyProviderSkillsRoutes } from './v1/providers/me/skills.js';
import { registerMyServiceAreasRoutes } from './v1/providers/me/serviceAreas.js';
import { registerMyAvailabilityRoutes } from './v1/providers/me/availability.js';
import { registerAdminProviderRoutes } from './v1/providers/admin/providers.js';
import { registerAdminSkillsRoutes } from './v1/providers/admin/skills.js';

export function registerRoutes(app: FastifyInstance, ctx: AppContext): void {
  // Static segments ("me", "admin", "skills") are registered alongside the
  // parametric :idOrSlug routes below; Fastify's router always prefers a
  // static match over a parametric one at the same path depth, so
  // /providers/me, /providers/admin, and /providers/skills never get
  // swallowed by /providers/:idOrSlug.
  registerMyProviderProfileRoutes(app, ctx);
  registerMyProviderLifecycleRoutes(app, ctx);
  registerMyProviderServicesRoutes(app, ctx);
  registerMyProviderSkillsRoutes(app, ctx);
  registerMyServiceAreasRoutes(app, ctx);
  registerMyAvailabilityRoutes(app, ctx);

  registerAdminProviderRoutes(app, ctx);
  registerAdminSkillsRoutes(app, ctx);

  registerSkillsCatalogRoute(app, ctx);

  registerListProvidersRoute(app, ctx);
  registerGetProviderRoute(app, ctx);
  registerPublicProviderSubResourceRoutes(app, ctx);
}
