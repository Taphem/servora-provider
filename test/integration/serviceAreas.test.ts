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

describe.skipIf(!isInfraAvailable())('provider service areas', () => {
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

  it('adds a service area with just country/city', async () => {
    await createMyProvider(testApp);
    const response = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me/service-areas',
      headers: PROVIDER_HEADERS,
      payload: { countryCode: 'us', city: 'Austin' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().countryCode).toBe('US');
  });

  it('rejects a duplicate area (same country/region/city/postalCode)', async () => {
    await createMyProvider(testApp);
    await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me/service-areas',
      headers: PROVIDER_HEADERS,
      payload: { countryCode: 'US', city: 'Austin' },
    });
    const duplicate = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me/service-areas',
      headers: PROVIDER_HEADERS,
      payload: { countryCode: 'US', city: 'Austin' },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe('SERVICE_AREA_ALREADY_EXISTS');
  });

  it('allows the same city with a different postal code', async () => {
    await createMyProvider(testApp);
    await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me/service-areas',
      headers: PROVIDER_HEADERS,
      payload: { countryCode: 'US', city: 'Austin', postalCode: '78701' },
    });
    const second = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me/service-areas',
      headers: PROVIDER_HEADERS,
      payload: { countryCode: 'US', city: 'Austin', postalCode: '78702' },
    });
    expect(second.statusCode).toBe(201);
  });

  it('rejects radiusKm without coordinates', async () => {
    await createMyProvider(testApp);
    const response = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me/service-areas',
      headers: PROVIDER_HEADERS,
      payload: { countryCode: 'US', city: 'Austin', radiusKm: 10 },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_FAILED');
  });

  it('accepts coordinates with a radius', async () => {
    await createMyProvider(testApp);
    const response = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me/service-areas',
      headers: PROVIDER_HEADERS,
      payload: { countryCode: 'US', city: 'Austin', latitude: 30.2672, longitude: -97.7431, radiusKm: 25 },
    });
    expect(response.statusCode).toBe(201);
  });

  it('lists and removes a service area', async () => {
    await createMyProvider(testApp);
    const created = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me/service-areas',
      headers: PROVIDER_HEADERS,
      payload: { countryCode: 'US', city: 'Austin' },
    });
    const { id } = created.json();

    const list = await testApp.app.inject({ method: 'GET', url: '/api/v1/providers/me/service-areas', headers: PROVIDER_HEADERS });
    expect(list.json().data).toHaveLength(1);

    const removed = await testApp.app.inject({
      method: 'DELETE',
      url: `/api/v1/providers/me/service-areas/${id}`,
      headers: PROVIDER_HEADERS,
    });
    expect(removed.statusCode).toBe(204);

    const missing = await testApp.app.inject({
      method: 'DELETE',
      url: `/api/v1/providers/me/service-areas/${id}`,
      headers: PROVIDER_HEADERS,
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('SERVICE_AREA_NOT_FOUND');
  });
});
