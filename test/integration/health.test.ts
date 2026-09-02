import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../helpers/buildTestApp.js';

describe('health', () => {
  it('GET /health returns ok without touching the database', async () => {
    const testApp = buildTestApp();
    try {
      const response = await testApp.app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
    } finally {
      await testApp.close();
    }
  });

  it('GET /ready returns 503 before readiness is marked', async () => {
    const testApp = buildTestApp();
    try {
      const response = await testApp.app.inject({ method: 'GET', url: '/ready' });
      expect(response.statusCode).toBe(503);
    } finally {
      await testApp.close();
    }
  });
});
