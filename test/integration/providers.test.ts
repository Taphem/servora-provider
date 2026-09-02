import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_HEADERS, buildTestApp, OTHER_PROVIDER_HEADERS, PROVIDER_HEADERS, resetDatabase, type TestApp } from '../helpers/buildTestApp.js';
import { isInfraAvailable } from './helpers.js';

async function createMyProvider(testApp: TestApp, headers: Record<string, string> = PROVIDER_HEADERS, overrides: Record<string, unknown> = {}) {
  return testApp.app.inject({
    method: 'POST',
    url: '/api/v1/providers/me',
    headers,
    payload: { displayName: 'Jane Plumber', ...overrides },
  });
}

describe.skipIf(!isInfraAvailable())('provider profile', () => {
  let testApp: TestApp;

  beforeAll(() => {
    testApp = buildTestApp();
  });

  afterEach(async () => {
    await resetDatabase(testApp.ctx);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('creates a provider profile for the authenticated BUSINESS_OWNER identity', async () => {
    const response = await createMyProvider(testApp);
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.slug).toBe('jane-plumber');
    expect(body.status).toBe('PENDING_ONBOARDING');
    expect(body.verificationStatus).toBe('UNVERIFIED');
    expect(body.userId).toBe(PROVIDER_HEADERS['x-user-id']);
  });

  it('rejects a second profile for the same user with 409 PROVIDER_ALREADY_EXISTS', async () => {
    await createMyProvider(testApp);
    const second = await createMyProvider(testApp);
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('PROVIDER_ALREADY_EXISTS');
  });

  it('rejects a duplicate slug with 409 PROVIDER_SLUG_ALREADY_EXISTS', async () => {
    await createMyProvider(testApp, PROVIDER_HEADERS, { slug: 'jane-plumber' });
    const second = await createMyProvider(testApp, OTHER_PROVIDER_HEADERS, { slug: 'jane-plumber' });
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('PROVIDER_SLUG_ALREADY_EXISTS');
  });

  it('GET /me returns the private DTO including userId but never admin-only fields', async () => {
    await createMyProvider(testApp);
    const response = await testApp.app.inject({ method: 'GET', url: '/api/v1/providers/me', headers: PROVIDER_HEADERS });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.userId).toBeDefined();
    expect(body).not.toHaveProperty('verificationReviewedBy');
    expect(body).not.toHaveProperty('verificationReviewedAt');
  });

  it('PATCH /me updates the caller profile', async () => {
    await createMyProvider(testApp);
    const response = await testApp.app.inject({
      method: 'PATCH',
      url: '/api/v1/providers/me',
      headers: PROVIDER_HEADERS,
      payload: { bio: 'Licensed plumber, 10 years experience.' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().bio).toBe('Licensed plumber, 10 years experience.');
  });

  it('a PENDING_ONBOARDING provider is not visible on the public profile endpoint', async () => {
    const created = await createMyProvider(testApp);
    const { slug } = created.json();

    const publicGet = await testApp.app.inject({ method: 'GET', url: `/api/v1/providers/${slug}` });
    expect(publicGet.statusCode).toBe(404);

    const publicList = await testApp.app.inject({ method: 'GET', url: '/api/v1/providers' });
    expect(publicList.json().data).toHaveLength(0);
  });

  it('an ACTIVE provider is visible publicly and never leaks private fields', async () => {
    await createMyProvider(testApp);
    await testApp.app.inject({ method: 'POST', url: '/api/v1/providers/me/activate', headers: PROVIDER_HEADERS });

    const publicGet = await testApp.app.inject({ method: 'GET', url: '/api/v1/providers/jane-plumber' });
    expect(publicGet.statusCode).toBe(200);
    const body = publicGet.json();
    expect(body).not.toHaveProperty('userId');
    expect(body).not.toHaveProperty('verificationNotes');
    expect(body).not.toHaveProperty('disabledReason');
    expect(body).not.toHaveProperty('verificationReviewedBy');
  });

  it('admin sees PENDING_ONBOARDING/DISABLED providers that public reads 404 on', async () => {
    const created = await createMyProvider(testApp);
    const { id } = created.json();

    const adminGet = await testApp.app.inject({ method: 'GET', url: `/api/v1/providers/admin/${id}`, headers: ADMIN_HEADERS });
    expect(adminGet.statusCode).toBe(200);
    expect(adminGet.json().status).toBe('PENDING_ONBOARDING');
  });

  it('returns 404 PROVIDER_NOT_FOUND for a missing provider', async () => {
    const response = await testApp.app.inject({ method: 'GET', url: '/api/v1/providers/does-not-exist' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('PROVIDER_NOT_FOUND');
  });
});
