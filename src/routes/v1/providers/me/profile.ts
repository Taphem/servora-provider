import { createHash, randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { AppContext } from '../../../../app/context.js';
import { requireProvider } from '../../../../middleware/requireAuth.js';
import { parseCreateProviderBody, parseUpdateProviderBody } from '../../../../schemas/providers.js';
import { createProvider, requireProviderByUserId, updateProvider } from '../../../../services/providerService.js';
import { toPrivateProviderDto } from '../../../../dto/providerDto.js';

export function registerMyProviderProfileRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post('/api/v1/providers/me/profile-photo-upload', { preHandler: requireProvider }, async (request) => {
    const timestamp = Math.floor(Date.now() / 1000);
    // The folder includes the authenticated user id, so the profile schema
    // can reject a Cloudinary asset belonging to another provider.
    const publicId = `servora/providers/${request.identity!.userId}/${randomUUID()}`;
    const allowedFormats = 'jpg,jpeg,png,webp';
    const maxFileSize = 5 * 1024 * 1024;
    const signatureBase = `allowed_formats=${allowedFormats}&public_id=${publicId}&timestamp=${timestamp}&upload_preset=${ctx.env.CLOUDINARY_PROVIDER_UPLOAD_PRESET}`;
    const signature = createHash('sha1').update(signatureBase + ctx.env.CLOUDINARY_API_SECRET).digest('hex');

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${ctx.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      apiKey: ctx.env.CLOUDINARY_API_KEY,
      timestamp,
      signature,
      publicId,
      uploadPreset: ctx.env.CLOUDINARY_PROVIDER_UPLOAD_PRESET,
      allowedFormats: allowedFormats.split(','),
      maxBytes: maxFileSize,
    };
  });

  app.post('/api/v1/providers/me', { preHandler: requireProvider }, async (request, reply) => {
    const body = parseCreateProviderBody(request.body, ctx.env.CLOUDINARY_CLOUD_NAME, request.identity!.userId);
    const provider = await createProvider(ctx.pool, request.identity!.userId, body);
    reply.status(201);
    return toPrivateProviderDto(provider);
  });

  app.get('/api/v1/providers/me', { preHandler: requireProvider }, async (request) => {
    const provider = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    return toPrivateProviderDto(provider);
  });

  app.patch('/api/v1/providers/me', { preHandler: requireProvider }, async (request) => {
    const body = parseUpdateProviderBody(request.body, ctx.env.CLOUDINARY_CLOUD_NAME, request.identity!.userId);
    const existing = await requireProviderByUserId(ctx.pool, request.identity!.userId);
    const provider = await updateProvider(ctx.pool, ctx.cache, existing.id, body);
    return toPrivateProviderDto(provider);
  });
}
