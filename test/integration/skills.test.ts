import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ADMIN_HEADERS, buildTestApp, PROVIDER_HEADERS, resetDatabase, type TestApp } from '../helpers/buildTestApp.js';
import { isInfraAvailable } from './helpers.js';

async function createSkill(testApp: TestApp, name = 'AC Technician') {
  const response = await testApp.app.inject({
    method: 'POST',
    url: '/api/v1/providers/admin/skills',
    headers: ADMIN_HEADERS,
    payload: { name },
  });
  return response.json();
}

async function createMyProvider(testApp: TestApp) {
  const response = await testApp.app.inject({
    method: 'POST',
    url: '/api/v1/providers/me',
    headers: PROVIDER_HEADERS,
    payload: { displayName: 'Jane Plumber' },
  });
  return response.json();
}

describe.skipIf(!isInfraAvailable())('skills catalog', () => {
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

  it('admin creates a skill; duplicate slug is rejected', async () => {
    const created = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/admin/skills',
      headers: ADMIN_HEADERS,
      payload: { name: 'AC Technician' },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().slug).toBe('ac-technician');

    const duplicate = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/admin/skills',
      headers: ADMIN_HEADERS,
      payload: { name: 'AC Technician' },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe('SKILL_SLUG_ALREADY_EXISTS');
  });

  it('non-admin cannot create a skill', async () => {
    const response = await testApp.app.inject({
      method: 'POST',
      url: '/api/v1/providers/admin/skills',
      headers: PROVIDER_HEADERS,
      payload: { name: 'Plumber' },
    });
    expect(response.statusCode).toBe(403);
  });

  it('public GET only returns ACTIVE skills; admin sees INACTIVE too', async () => {
    await createSkill(testApp, 'AC Technician');
    const inactive = await createSkill(testApp, 'Retired Skill');
    await testApp.app.inject({
      method: 'PATCH',
      url: `/api/v1/providers/admin/skills/${inactive.id}`,
      headers: ADMIN_HEADERS,
      payload: { status: 'INACTIVE' },
    });

    const publicList = await testApp.app.inject({ method: 'GET', url: '/api/v1/providers/skills' });
    expect(publicList.json().data).toHaveLength(1);

    const adminList = await testApp.app.inject({ method: 'GET', url: '/api/v1/providers/skills', headers: ADMIN_HEADERS });
    expect(adminList.json().data).toHaveLength(2);
  });

  it('a provider replaces their skill set atomically and rejects an unknown or inactive skillId', async () => {
    await createMyProvider(testApp);
    const skillA = await createSkill(testApp, 'AC Technician');
    const skillB = await createSkill(testApp, 'Electrician');

    const replaced = await testApp.app.inject({
      method: 'PUT',
      url: '/api/v1/providers/me/skills',
      headers: PROVIDER_HEADERS,
      payload: { skillIds: [skillA.id, skillB.id] },
    });
    expect(replaced.statusCode).toBe(200);
    expect(replaced.json().data).toHaveLength(2);

    const unknown = await testApp.app.inject({
      method: 'PUT',
      url: '/api/v1/providers/me/skills',
      headers: PROVIDER_HEADERS,
      payload: { skillIds: ['99999999-9999-4999-8999-999999999999'] },
    });
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json().error.code).toBe('SKILL_NOT_FOUND');

    await testApp.app.inject({
      method: 'PATCH',
      url: `/api/v1/providers/admin/skills/${skillA.id}`,
      headers: ADMIN_HEADERS,
      payload: { status: 'INACTIVE' },
    });
    const inactiveAttempt = await testApp.app.inject({
      method: 'PUT',
      url: '/api/v1/providers/me/skills',
      headers: PROVIDER_HEADERS,
      payload: { skillIds: [skillA.id] },
    });
    expect(inactiveAttempt.statusCode).toBe(400);
    expect(inactiveAttempt.json().error.code).toBe('SKILL_INACTIVE');
  });

  it('rejects duplicate skillIds in a single replace request', async () => {
    await createMyProvider(testApp);
    const skill = await createSkill(testApp);
    const response = await testApp.app.inject({
      method: 'PUT',
      url: '/api/v1/providers/me/skills',
      headers: PROVIDER_HEADERS,
      payload: { skillIds: [skill.id, skill.id] },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_FAILED');
  });
});
