import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_HEADERS, buildTestApp, resetDatabase, type TestApp } from '../helpers/buildTestApp.js';
import { isInfraAvailable } from './helpers.js';

async function createProvider(testApp: TestApp, index: number) {
  const headers = { 'x-user-id': `55555555-5555-5555-5555-${String(index).padStart(12, '0')}`, 'x-user-role': 'BUSINESS_OWNER' };
  const created = await testApp.app.inject({
    method: 'POST',
    url: '/api/v1/providers/me',
    headers,
    payload: { displayName: `Provider ${index}` },
  });
  await testApp.app.inject({ method: 'POST', url: '/api/v1/providers/me/activate', headers });
  return created.json();
}

describe.skipIf(!isInfraAvailable())('provider list pagination', () => {
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

  it('bounds pageSize to MAX_PAGE_SIZE', async () => {
    const response = await testApp.app.inject({ method: 'GET', url: '/api/v1/providers?pageSize=99999' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_FAILED');
  });

  it('defaults to page 1 and returns stable ordering with correct totals', async () => {
    for (let i = 1; i <= 3; i += 1) {
      await createProvider(testApp, i);
    }

    const firstPage = await testApp.app.inject({ method: 'GET', url: '/api/v1/providers?pageSize=2' });
    const firstBody = firstPage.json();
    expect(firstBody.data).toHaveLength(2);
    expect(firstBody.pagination).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });

    const secondPage = await testApp.app.inject({ method: 'GET', url: '/api/v1/providers?pageSize=2&page=2' });
    expect(secondPage.json().data).toHaveLength(1);

    const ids = new Set([...firstBody.data, ...secondPage.json().data].map((p: { id: string }) => p.id));
    expect(ids.size).toBe(3);
  });

  it('an empty result set reports zero totalPages', async () => {
    const response = await testApp.app.inject({ method: 'GET', url: '/api/v1/providers' });
    expect(response.json().pagination).toEqual({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  });

  it('admin listing filters by verificationStatus', async () => {
    await createProvider(testApp, 1);
    await createProvider(testApp, 2);

    const response = await testApp.app.inject({
      method: 'GET',
      url: '/api/v1/providers/admin?verificationStatus=UNVERIFIED',
      headers: ADMIN_HEADERS,
    });
    expect(response.json().pagination.total).toBe(2);
  });
});
