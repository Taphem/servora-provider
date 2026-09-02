import { describe, expect, it } from 'vitest';
import { createProviderBodySchema, adminSetStatusBodySchema } from '../../src/schemas/providers.js';
import { createServiceAreaBodySchema } from '../../src/schemas/serviceAreas.js';
import { createProviderServiceBodySchema } from '../../src/schemas/providerServices.js';

describe('createProviderBodySchema', () => {
  it('rejects an unknown IANA timezone', () => {
    const result = createProviderBodySchema.safeParse({ displayName: 'Jane', timezone: 'Not/AZone' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid IANA timezone', () => {
    const result = createProviderBodySchema.safeParse({ displayName: 'Jane', timezone: 'Asia/Kolkata' });
    expect(result.success).toBe(true);
  });

  it('rejects unknown fields (strict)', () => {
    const result = createProviderBodySchema.safeParse({ displayName: 'Jane', email: 'jane@example.com' });
    expect(result.success).toBe(false);
  });
});

describe('adminSetStatusBodySchema', () => {
  it('requires a reason when disabling', () => {
    expect(adminSetStatusBodySchema.safeParse({ status: 'DISABLED' }).success).toBe(false);
    expect(adminSetStatusBodySchema.safeParse({ status: 'DISABLED', reason: 'fraud' }).success).toBe(true);
  });

  it('does not require a reason for ACTIVE', () => {
    expect(adminSetStatusBodySchema.safeParse({ status: 'ACTIVE' }).success).toBe(true);
  });
});

describe('createServiceAreaBodySchema', () => {
  it('requires latitude and longitude together', () => {
    expect(createServiceAreaBodySchema.safeParse({ countryCode: 'US', city: 'Austin', latitude: 30.1 }).success).toBe(false);
  });

  it('rejects a 3-letter country code', () => {
    expect(createServiceAreaBodySchema.safeParse({ countryCode: 'USA', city: 'Austin' }).success).toBe(false);
  });
});

describe('createProviderServiceBodySchema', () => {
  it('requires priceAmount and priceCurrency together', () => {
    expect(createProviderServiceBodySchema.safeParse({ serviceId: '99999999-9999-4999-8999-999999999901', priceAmount: 10 }).success).toBe(
      false,
    );
  });

  it('accepts neither price field set', () => {
    expect(createProviderServiceBodySchema.safeParse({ serviceId: '99999999-9999-4999-8999-999999999901' }).success).toBe(true);
  });
});
