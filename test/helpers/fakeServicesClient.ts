import type { ServicesClient, UpstreamService } from '../../src/clients/servicesClient.js';

/**
 * In-memory stand-in for servora-services used by every integration test —
 * no test in this suite ever makes a real HTTP call, matching the "Services
 * API integration tests where appropriate" bar via a controllable fake
 * rather than a live dependency the test suite can't control.
 */
export class FakeServicesClient implements ServicesClient {
  private readonly services = new Map<string, UpstreamService>();

  seed(service: UpstreamService): void {
    this.services.set(service.id, service);
  }

  clear(): void {
    this.services.clear();
  }

  async getServiceById(serviceId: string): Promise<UpstreamService | undefined> {
    return this.services.get(serviceId);
  }
}

export function activeUpstreamService(overrides: Partial<UpstreamService> = {}): UpstreamService {
  return {
    id: overrides.id ?? '99999999-9999-4999-8999-999999999901',
    categoryId: '99999999-9999-4999-8999-999999999001',
    name: 'AC Repair',
    slug: 'ac-repair',
    status: 'ACTIVE',
    bookingMode: 'PROVIDER_SELECTION',
    ...overrides,
  };
}
