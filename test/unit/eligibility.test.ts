import { describe, expect, it } from 'vitest';
import { computeEligibility } from '../../src/domain/eligibility.js';
import { ProviderStatus, VerificationStatus } from '../../src/domain/types.js';

const readyProvider = { status: ProviderStatus.ACTIVE, verificationStatus: VerificationStatus.VERIFIED };

describe('computeEligibility', () => {
  it('is eligible when active, verified, with an offering and a service area', () => {
    const result = computeEligibility({ provider: readyProvider, hasEnabledServiceOffering: true, hasServiceArea: true });
    expect(result).toEqual({ eligible: true, reasons: [] });
  });

  it('reports every unmet condition, not just the first', () => {
    const result = computeEligibility({
      provider: { status: ProviderStatus.PAUSED, verificationStatus: VerificationStatus.UNVERIFIED },
      hasEnabledServiceOffering: false,
      hasServiceArea: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual([
      'PROVIDER_NOT_ACTIVE',
      'PROVIDER_NOT_VERIFIED',
      'NO_ENABLED_SERVICE_OFFERINGS',
      'NO_SERVICE_AREAS',
    ]);
  });

  it('is ineligible when active+verified but no offerings', () => {
    const result = computeEligibility({ provider: readyProvider, hasEnabledServiceOffering: false, hasServiceArea: true });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(['NO_ENABLED_SERVICE_OFFERINGS']);
  });
});
