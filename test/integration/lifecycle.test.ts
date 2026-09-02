import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_HEADERS, buildTestApp, PROVIDER_HEADERS, resetDatabase, type TestApp } from '../helpers/buildTestApp.js';
import { isInfraAvailable } from './helpers.js';

async function createMyProvider(testApp: TestApp) {
  const response = await testApp.app.inject({
    method: 'POST',
    url: '/api/v1/providers/me',
    headers: PROVIDER_HEADERS,
    payload: { displayName: 'Jane Plumber' },
  });
  return response.json();
}

describe.skipIf(!isInfraAvailable())('provider status lifecycle', () => {
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

  it('activates from PENDING_ONBOARDING and pauses/reactivates', async () => {
    await createMyProvider(testApp);

    const activated = await testApp.app.inject({ method: 'POST', url: '/api/v1/providers/me/activate', headers: PROVIDER_HEADERS });
    expect(activated.json().status).toBe('ACTIVE');

    const paused = await testApp.app.inject({ method: 'POST', url: '/api/v1/providers/me/pause', headers: PROVIDER_HEADERS });
    expect(paused.json().status).toBe('PAUSED');

    const reactivated = await testApp.app.inject({ method: 'POST', url: '/api/v1/providers/me/activate', headers: PROVIDER_HEADERS });
    expect(reactivated.json().status).toBe('ACTIVE');
  });

  it('rejects pausing a provider that is not yet ACTIVE', async () => {
    await createMyProvider(testApp);
    const response = await testApp.app.inject({ method: 'POST', url: '/api/v1/providers/me/pause', headers: PROVIDER_HEADERS });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('a provider cannot self-disable or self-reactivate out of DISABLED', async () => {
    const provider = await createMyProvider(testApp);
    await testApp.app.inject({
      method: 'PATCH',
      url: `/api/v1/providers/admin/${provider.id}/status`,
      headers: ADMIN_HEADERS,
      payload: { status: 'DISABLED', reason: 'policy violation' },
    });

    const attempt = await testApp.app.inject({ method: 'POST', url: '/api/v1/providers/me/activate', headers: PROVIDER_HEADERS });
    expect(attempt.statusCode).toBe(409);
  });

  it('requires a reason when an admin disables a provider', async () => {
    const provider = await createMyProvider(testApp);
    const response = await testApp.app.inject({
      method: 'PATCH',
      url: `/api/v1/providers/admin/${provider.id}/status`,
      headers: ADMIN_HEADERS,
      payload: { status: 'DISABLED' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_FAILED');
  });

  it('admin can reactivate a DISABLED provider', async () => {
    const provider = await createMyProvider(testApp);
    await testApp.app.inject({
      method: 'PATCH',
      url: `/api/v1/providers/admin/${provider.id}/status`,
      headers: ADMIN_HEADERS,
      payload: { status: 'DISABLED', reason: 'policy violation' },
    });

    const reactivated = await testApp.app.inject({
      method: 'PATCH',
      url: `/api/v1/providers/admin/${provider.id}/status`,
      headers: ADMIN_HEADERS,
      payload: { status: 'ACTIVE' },
    });
    expect(reactivated.statusCode).toBe(200);
    expect(reactivated.json().status).toBe('ACTIVE');
    expect(reactivated.json().disabledReason).toBeNull();
  });
});

describe.skipIf(!isInfraAvailable())('provider verification lifecycle', () => {
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

  it('submits for review then an admin approves', async () => {
    const provider = await createMyProvider(testApp);

    const submitted = await testApp.app.inject({ method: 'POST', url: '/api/v1/providers/me/verification/submit', headers: PROVIDER_HEADERS });
    expect(submitted.json().verificationStatus).toBe('PENDING_REVIEW');

    const approved = await testApp.app.inject({
      method: 'PATCH',
      url: `/api/v1/providers/admin/${provider.id}/verification`,
      headers: ADMIN_HEADERS,
      payload: { verificationStatus: 'VERIFIED' },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().verificationStatus).toBe('VERIFIED');
    expect(approved.json().verificationReviewedBy).toBe(ADMIN_HEADERS['x-user-id']);
  });

  it('an admin cannot approve/reject before a submission exists', async () => {
    const provider = await createMyProvider(testApp);
    const response = await testApp.app.inject({
      method: 'PATCH',
      url: `/api/v1/providers/admin/${provider.id}/verification`,
      headers: ADMIN_HEADERS,
      payload: { verificationStatus: 'VERIFIED' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('INVALID_VERIFICATION_TRANSITION');
  });

  it('requires notes when rejecting, and a rejected provider can resubmit', async () => {
    const provider = await createMyProvider(testApp);
    await testApp.app.inject({ method: 'POST', url: '/api/v1/providers/me/verification/submit', headers: PROVIDER_HEADERS });

    const missingNotes = await testApp.app.inject({
      method: 'PATCH',
      url: `/api/v1/providers/admin/${provider.id}/verification`,
      headers: ADMIN_HEADERS,
      payload: { verificationStatus: 'REJECTED' },
    });
    expect(missingNotes.statusCode).toBe(400);

    const rejected = await testApp.app.inject({
      method: 'PATCH',
      url: `/api/v1/providers/admin/${provider.id}/verification`,
      headers: ADMIN_HEADERS,
      payload: { verificationStatus: 'REJECTED', notes: 'ID document was blurry.' },
    });
    expect(rejected.json().verificationStatus).toBe('REJECTED');

    const resubmitted = await testApp.app.inject({ method: 'POST', url: '/api/v1/providers/me/verification/submit', headers: PROVIDER_HEADERS });
    expect(resubmitted.json().verificationStatus).toBe('PENDING_REVIEW');
  });
});

describe.skipIf(!isInfraAvailable())('marketplace eligibility', () => {
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

  it('is ineligible until ACTIVE, VERIFIED, with an offering and a service area', async () => {
    const provider = await createMyProvider(testApp);

    const initial = await testApp.app.inject({ method: 'GET', url: `/api/v1/providers/${provider.id}/eligibility`, headers: ADMIN_HEADERS });
    expect(initial.json().eligible).toBe(false);
    expect(initial.json().reasons).toContain('PROVIDER_NOT_ACTIVE');
    expect(initial.json().reasons).toContain('PROVIDER_NOT_VERIFIED');
    expect(initial.json().reasons).toContain('NO_ENABLED_SERVICE_OFFERINGS');
    expect(initial.json().reasons).toContain('NO_SERVICE_AREAS');

    await testApp.app.inject({ method: 'POST', url: '/api/v1/providers/me/activate', headers: PROVIDER_HEADERS });
    await testApp.app.inject({ method: 'POST', url: '/api/v1/providers/me/verification/submit', headers: PROVIDER_HEADERS });
    await testApp.app.inject({
      method: 'PATCH',
      url: `/api/v1/providers/admin/${provider.id}/verification`,
      headers: ADMIN_HEADERS,
      payload: { verificationStatus: 'VERIFIED' },
    });
    await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me/service-areas',
      headers: PROVIDER_HEADERS,
      payload: { countryCode: 'US', city: 'Austin' },
    });

    testApp.servicesClient.seed({
      id: '99999999-9999-4999-8999-999999999901',
      categoryId: '99999999-9999-4999-8999-999999999001',
      name: 'AC Repair',
      slug: 'ac-repair',
      status: 'ACTIVE',
      bookingMode: 'PROVIDER_SELECTION',
    });
    await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me/services',
      headers: PROVIDER_HEADERS,
      payload: { serviceId: '99999999-9999-4999-8999-999999999901' },
    });

    const final = await testApp.app.inject({ method: 'GET', url: `/api/v1/providers/${provider.id}/eligibility`, headers: ADMIN_HEADERS });
    expect(final.json()).toEqual({ eligible: true, reasons: [] });
  });
});
