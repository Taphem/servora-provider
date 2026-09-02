import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildTestApp, PROVIDER_HEADERS, resetDatabase, type TestApp } from '../helpers/buildTestApp.js';
import { activeUpstreamService } from '../helpers/fakeServicesClient.js';
import { isInfraAvailable } from './helpers.js';

const SERVICE_ID = '99999999-9999-4999-8999-999999999901';

async function createMyProvider(testApp: TestApp) {
  const response = await testApp.app.inject({
    method: 'POST',
    url: '/api/v1/providers/me',
    headers: PROVIDER_HEADERS,
    payload: { displayName: 'Jane Plumber' },
  });
  return response.json();
}

describe.skipIf(!isInfraAvailable())('provider service offerings', () => {
  let testApp: TestApp;

  beforeAll(() => {
    testApp = buildTestApp();
  });

  afterEach(async () => {
    await resetDatabase(testApp.ctx);
    testApp.servicesClient.clear();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('adds an offering after validating the service_id against servora-services', async () => {
    await createMyProvider(testApp);
    testApp.servicesClient.seed(activeUpstreamService({ id: SERVICE_ID }));

    const response = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me/services',
      headers: PROVIDER_HEADERS,
      payload: { serviceId: SERVICE_ID, priceAmount: 49.99, priceCurrency: 'usd' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().serviceId).toBe(SERVICE_ID);
    expect(response.json().priceCurrency).toBe('USD');
  });

  it('rejects a serviceId that does not exist upstream', async () => {
    await createMyProvider(testApp);
    const response = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me/services',
      headers: PROVIDER_HEADERS,
      payload: { serviceId: SERVICE_ID },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('UPSTREAM_SERVICE_NOT_FOUND');
  });

  it('rejects a serviceId that exists but is not ACTIVE', async () => {
    await createMyProvider(testApp);
    testApp.servicesClient.seed(activeUpstreamService({ id: SERVICE_ID, status: 'DRAFT' }));

    const response = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me/services',
      headers: PROVIDER_HEADERS,
      payload: { serviceId: SERVICE_ID },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('UPSTREAM_SERVICE_INACTIVE');
  });

  it('prevents offering the same service twice', async () => {
    await createMyProvider(testApp);
    testApp.servicesClient.seed(activeUpstreamService({ id: SERVICE_ID }));
    await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me/services',
      headers: PROVIDER_HEADERS,
      payload: { serviceId: SERVICE_ID },
    });

    const duplicate = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me/services',
      headers: PROVIDER_HEADERS,
      payload: { serviceId: SERVICE_ID },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe('SERVICE_OFFERING_ALREADY_EXISTS');
  });

  it('rejects a priceAmount without a priceCurrency', async () => {
    await createMyProvider(testApp);
    testApp.servicesClient.seed(activeUpstreamService({ id: SERVICE_ID }));
    const response = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me/services',
      headers: PROVIDER_HEADERS,
      payload: { serviceId: SERVICE_ID, priceAmount: 49.99 },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_FAILED');
  });

  it('disables an offering via PATCH and it disappears from the public list', async () => {
    const provider = await createMyProvider(testApp);
    await testApp.app.inject({ method: 'POST', url: '/api/v1/providers/me/activate', headers: PROVIDER_HEADERS });
    testApp.servicesClient.seed(activeUpstreamService({ id: SERVICE_ID }));
    await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me/services',
      headers: PROVIDER_HEADERS,
      payload: { serviceId: SERVICE_ID },
    });

    const disabled = await testApp.app.inject({
      method: 'PATCH',
      url: `/api/v1/providers/me/services/${SERVICE_ID}`,
      headers: PROVIDER_HEADERS,
      payload: { isEnabled: false },
    });
    expect(disabled.statusCode).toBe(200);
    expect(disabled.json().isEnabled).toBe(false);

    const publicList = await testApp.app.inject({ method: 'GET', url: `/api/v1/providers/${provider.slug}/services` });
    expect(publicList.json().data).toHaveLength(0);
  });

  it('removes an offering with DELETE', async () => {
    await createMyProvider(testApp);
    testApp.servicesClient.seed(activeUpstreamService({ id: SERVICE_ID }));
    await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/me/services',
      headers: PROVIDER_HEADERS,
      payload: { serviceId: SERVICE_ID },
    });

    const deleted = await testApp.app.inject({
      method: 'DELETE',
      url: `/api/v1/providers/me/services/${SERVICE_ID}`,
      headers: PROVIDER_HEADERS,
    });
    expect(deleted.statusCode).toBe(204);

    const missing = await testApp.app.inject({
      method: 'DELETE',
      url: `/api/v1/providers/me/services/${SERVICE_ID}`,
      headers: PROVIDER_HEADERS,
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('SERVICE_OFFERING_NOT_FOUND');
  });
});
