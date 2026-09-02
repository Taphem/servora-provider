import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  ADMIN_HEADERS,
  buildTestApp,
  CUSTOMER_HEADERS,
  OTHER_PROVIDER_HEADERS,
  PROVIDER_HEADERS,
  resetDatabase,
  type TestApp,
} from '../helpers/buildTestApp.js';
import { isInfraAvailable } from './helpers.js';

describe.skipIf(!isInfraAvailable())('authorization', () => {
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

  it('public discovery reads succeed with no identity headers at all', async () => {
    const response = await testApp.app.inject({ method: 'GET', url: '/api/v1/providers' });
    expect(response.statusCode).toBe(200);
  });

  it('rejects POST /providers/me with 401 UNAUTHENTICATED when no identity headers are present', async () => {
    const response = await testApp.app.inject({ method: 'POST', url: '/api/v1/providers/me', payload: { displayName: 'X' } });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects POST /providers/me with 403 FORBIDDEN for a CUSTOMER identity', async () => {
    const response = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me',
      headers: CUSTOMER_HEADERS,
      payload: { displayName: 'X' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('rejects admin routes for a non-admin BUSINESS_OWNER identity', async () => {
    const response = await testApp.app.inject({ method: 'GET', url: '/api/v1/providers/admin', headers: PROVIDER_HEADERS });
    expect(response.statusCode).toBe(403);
  });

  it('allows admin routes for an ADMIN identity', async () => {
    const response = await testApp.app.inject({ method: 'GET', url: '/api/v1/providers/admin', headers: ADMIN_HEADERS });
    expect(response.statusCode).toBe(200);
  });

  it('prevents a provider from managing another provider by guessing their id (IDOR)', async () => {
    // Provider A creates their profile.
    const created = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me',
      headers: PROVIDER_HEADERS,
      payload: { displayName: 'Provider A' },
    });
    expect(created.statusCode).toBe(201);

    // Every self-service write route is scoped by request.identity.userId ->
    // that caller's own provider row, not by any id in the URL/body — there
    // is no route that accepts "which provider to modify" as a parameter,
    // so a second BUSINESS_OWNER identity acting on /providers/me always
    // acts on *their own* (nonexistent) profile, never provider A's.
    const otherPatch = await testApp.app.inject({
      method: 'PATCH',
      url: '/api/v1/providers/me',
      headers: OTHER_PROVIDER_HEADERS,
      payload: { bio: 'hijacked' },
    });
    expect(otherPatch.statusCode).toBe(404);
    expect(otherPatch.json().error.code).toBe('PROVIDER_NOT_FOUND');

    // Provider A's data is unaffected.
    const stillA = await testApp.app.inject({ method: 'GET', url: '/api/v1/providers/me', headers: PROVIDER_HEADERS });
    expect(stillA.json().bio).toBeNull();
  });
});
