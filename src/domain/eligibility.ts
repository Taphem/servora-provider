import { ProviderStatus, VerificationStatus, type Provider } from './types.js';

/**
 * Marketplace eligibility is a computed *fact*, not stored state: it is
 * always derived fresh from the provider's current status, verification,
 * offerings, and service areas, and it is deliberately never cached (see
 * README "Caching strategy") because a stale "eligible" answer is a
 * correctness bug, not a performance nuisance.
 *
 * This is provider-side eligibility only — "does this provider satisfy the
 * marketplace's baseline participation requirements right now?" It is an
 * input a future servora-booking matching/dispatch decision would consult,
 * not that decision itself: this service has no concept of a specific
 * booking request, ranking, or "who gets offered this job first".
 */
export const EligibilityReason = {
  PROVIDER_NOT_ACTIVE: 'PROVIDER_NOT_ACTIVE',
  PROVIDER_NOT_VERIFIED: 'PROVIDER_NOT_VERIFIED',
  NO_ENABLED_SERVICE_OFFERINGS: 'NO_ENABLED_SERVICE_OFFERINGS',
  NO_SERVICE_AREAS: 'NO_SERVICE_AREAS',
} as const;
export type EligibilityReason = (typeof EligibilityReason)[keyof typeof EligibilityReason];

export interface EligibilityInput {
  provider: Pick<Provider, 'status' | 'verificationStatus'>;
  hasEnabledServiceOffering: boolean;
  hasServiceArea: boolean;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: EligibilityReason[];
}

export function computeEligibility(input: EligibilityInput): EligibilityResult {
  const reasons: EligibilityReason[] = [];

  if (input.provider.status !== ProviderStatus.ACTIVE) {
    reasons.push(EligibilityReason.PROVIDER_NOT_ACTIVE);
  }
  if (input.provider.verificationStatus !== VerificationStatus.VERIFIED) {
    reasons.push(EligibilityReason.PROVIDER_NOT_VERIFIED);
  }
  if (!input.hasEnabledServiceOffering) {
    reasons.push(EligibilityReason.NO_ENABLED_SERVICE_OFFERINGS);
  }
  if (!input.hasServiceArea) {
    reasons.push(EligibilityReason.NO_SERVICE_AREAS);
  }

  return { eligible: reasons.length === 0, reasons };
}
