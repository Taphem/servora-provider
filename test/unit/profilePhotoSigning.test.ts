import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('profile photo upload signing', () => {
  it('signs exactly allowed_formats, public_id, timestamp, upload_preset and does not sign max_file_size', async () => {
    const testApp = buildTestApp();
    try {
      const userId = '0996605e-bd8f-4a25-a2cf-d2e2924f377e';
      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/v1/providers/me/profile-photo-upload',
        headers: {
          'x-user-id': userId,
          'x-user-role': 'BUSINESS_OWNER',
        },
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();

      expect(payload.uploadUrl).toBe('https://api.cloudinary.com/v1_1/servora-test/image/upload');
      expect(payload.apiKey).toBe('test-key');
      expect(payload.uploadPreset).toBe('servora_provider_photos');
      expect(payload.allowedFormats).toEqual(['jpg', 'jpeg', 'png', 'webp']);
      expect(payload.publicId).toMatch(new RegExp(`^servora/providers/${userId}/[0-9a-f-]+$`));

      const expectedStringWithoutMaxSize = `allowed_formats=jpg,jpeg,png,webp&public_id=${payload.publicId}&timestamp=${payload.timestamp}&upload_preset=servora_provider_photos`;
      const expectedSignature = createHash('sha1')
        .update(expectedStringWithoutMaxSize + 'test-secret')
        .digest('hex');

      expect(payload.signature).toBe(expectedSignature);

      // Verify that the signature does NOT match if max_file_size is included
      const stringWithMaxSize = `allowed_formats=jpg,jpeg,png,webp&max_file_size=5242880&public_id=${payload.publicId}&timestamp=${payload.timestamp}&upload_preset=servora_provider_photos`;
      const signatureWithMaxSize = createHash('sha1')
        .update(stringWithMaxSize + 'test-secret')
        .digest('hex');

      expect(payload.signature).not.toBe(signatureWithMaxSize);
    } finally {
      await testApp.close();
    }
  });
});
