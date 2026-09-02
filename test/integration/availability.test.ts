import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp, PROVIDER_HEADERS, resetDatabase, type TestApp } from '../helpers/buildTestApp.js';
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

describe.skipIf(!isInfraAvailable())('weekly availability', () => {
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

  it('replaces the weekly schedule atomically', async () => {
    await createMyProvider(testApp);
    const response = await testApp.app.inject({
      method: 'PUT',
      url: '/api/v1/providers/me/availability/weekly',
      headers: PROVIDER_HEADERS,
      payload: {
        slots: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
          { dayOfWeek: 6, startTime: '10:00', endTime: '14:00' },
        ],
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toHaveLength(2);

    const get = await testApp.app.inject({ method: 'GET', url: '/api/v1/providers/me/availability/weekly', headers: PROVIDER_HEADERS });
    expect(get.json().data).toHaveLength(2);
  });

  it('rejects an invalid time range (end before start)', async () => {
    await createMyProvider(testApp);
    const response = await testApp.app.inject({
      method: 'PUT',
      url: '/api/v1/providers/me/availability/weekly',
      headers: PROVIDER_HEADERS,
      payload: { slots: [{ dayOfWeek: 1, startTime: '17:00', endTime: '09:00' }] },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects overlapping slots on the same day', async () => {
    await createMyProvider(testApp);
    const response = await testApp.app.inject({
      method: 'PUT',
      url: '/api/v1/providers/me/availability/weekly',
      headers: PROVIDER_HEADERS,
      payload: {
        slots: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
          { dayOfWeek: 1, startTime: '12:00', endTime: '17:00' },
        ],
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects an invalid dayOfWeek', async () => {
    await createMyProvider(testApp);
    const response = await testApp.app.inject({
      method: 'PUT',
      url: '/api/v1/providers/me/availability/weekly',
      headers: PROVIDER_HEADERS,
      payload: { slots: [{ dayOfWeek: 7, startTime: '09:00', endTime: '17:00' }] },
    });
    expect(response.statusCode).toBe(400);
  });

  it('allows adjacent (non-overlapping) slots on the same day', async () => {
    await createMyProvider(testApp);
    const response = await testApp.app.inject({
      method: 'PUT',
      url: '/api/v1/providers/me/availability/weekly',
      headers: PROVIDER_HEADERS,
      payload: {
        slots: [
          { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
          { dayOfWeek: 1, startTime: '12:00', endTime: '17:00' },
        ],
      },
    });
    expect(response.statusCode).toBe(200);
  });
});

describe.skipIf(!isInfraAvailable())('availability date overrides', () => {
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

  it('upserts an unavailable-all-day override and lists it within a date range', async () => {
    await createMyProvider(testApp);
    const upserted = await testApp.app.inject({
      method: 'PUT',
      url: '/api/v1/providers/me/availability/overrides/2026-10-12',
      headers: PROVIDER_HEADERS,
      payload: { isUnavailable: true },
    });
    expect(upserted.statusCode).toBe(200);
    expect(upserted.json().isUnavailable).toBe(true);

    const list = await testApp.app.inject({
      method: 'GET',
      url: '/api/v1/providers/me/availability/overrides?from=2026-10-01&to=2026-10-31',
      headers: PROVIDER_HEADERS,
    });
    expect(list.json().data).toHaveLength(1);
  });

  it('upserts special hours for a specific date', async () => {
    await createMyProvider(testApp);
    const response = await testApp.app.inject({
      method: 'PUT',
      url: '/api/v1/providers/me/availability/overrides/2026-12-25',
      headers: PROVIDER_HEADERS,
      payload: { isUnavailable: false, startTime: '10:00', endTime: '12:00' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().startTime).toContain('10:00');
  });

  it('rejects special hours without start/end times', async () => {
    await createMyProvider(testApp);
    const response = await testApp.app.inject({
      method: 'PUT',
      url: '/api/v1/providers/me/availability/overrides/2026-12-25',
      headers: PROVIDER_HEADERS,
      payload: { isUnavailable: false },
    });
    expect(response.statusCode).toBe(400);
  });

  it('removes an override, reverting to the weekly default', async () => {
    await createMyProvider(testApp);
    await testApp.app.inject({
      method: 'PUT',
      url: '/api/v1/providers/me/availability/overrides/2026-10-12',
      headers: PROVIDER_HEADERS,
      payload: { isUnavailable: true },
    });

    const removed = await testApp.app.inject({
      method: 'DELETE',
      url: '/api/v1/providers/me/availability/overrides/2026-10-12',
      headers: PROVIDER_HEADERS,
    });
    expect(removed.statusCode).toBe(204);

    const missing = await testApp.app.inject({
      method: 'DELETE',
      url: '/api/v1/providers/me/availability/overrides/2026-10-12',
      headers: PROVIDER_HEADERS,
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('AVAILABILITY_OVERRIDE_NOT_FOUND');
  });
});
