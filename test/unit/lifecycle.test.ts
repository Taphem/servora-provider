import { describe, expect, it } from 'vitest';
import {
  assertCanSubmitForVerification,
  assertValidStatusTransition,
  assertValidVerificationDecision,
} from '../../src/domain/lifecycle.js';
import { AppError } from '../../src/errors/AppError.js';
import { ProviderStatus, VerificationStatus } from '../../src/domain/types.js';

describe('provider status transitions', () => {
  it('allows a provider to activate from PENDING_ONBOARDING', () => {
    expect(() => assertValidStatusTransition(ProviderStatus.PENDING_ONBOARDING, ProviderStatus.ACTIVE, 'provider')).not.toThrow();
  });

  it('allows a provider to pause from ACTIVE and reactivate from PAUSED', () => {
    expect(() => assertValidStatusTransition(ProviderStatus.ACTIVE, ProviderStatus.PAUSED, 'provider')).not.toThrow();
    expect(() => assertValidStatusTransition(ProviderStatus.PAUSED, ProviderStatus.ACTIVE, 'provider')).not.toThrow();
  });

  it('forbids a provider from disabling themselves', () => {
    expect(() => assertValidStatusTransition(ProviderStatus.ACTIVE, ProviderStatus.DISABLED, 'provider')).toThrow(AppError);
  });

  it('forbids a provider from reactivating out of DISABLED', () => {
    expect(() => assertValidStatusTransition(ProviderStatus.DISABLED, ProviderStatus.ACTIVE, 'provider')).toThrow(AppError);
  });

  it('allows an admin to disable from any state and to reactivate', () => {
    expect(() => assertValidStatusTransition(ProviderStatus.ACTIVE, ProviderStatus.DISABLED, 'admin')).not.toThrow();
    expect(() => assertValidStatusTransition(ProviderStatus.PENDING_ONBOARDING, ProviderStatus.DISABLED, 'admin')).not.toThrow();
    expect(() => assertValidStatusTransition(ProviderStatus.DISABLED, ProviderStatus.ACTIVE, 'admin')).not.toThrow();
  });

  it('forbids a no-op transition to the same status', () => {
    expect(() => assertValidStatusTransition(ProviderStatus.ACTIVE, ProviderStatus.ACTIVE, 'admin')).toThrow(AppError);
  });

  it('forbids skipping directly from PENDING_ONBOARDING to PAUSED', () => {
    expect(() => assertValidStatusTransition(ProviderStatus.PENDING_ONBOARDING, ProviderStatus.PAUSED, 'admin')).toThrow(AppError);
  });
});

describe('verification transitions', () => {
  it('allows submitting from UNVERIFIED or REJECTED', () => {
    expect(() => assertCanSubmitForVerification(VerificationStatus.UNVERIFIED)).not.toThrow();
    expect(() => assertCanSubmitForVerification(VerificationStatus.REJECTED)).not.toThrow();
  });

  it('forbids submitting from PENDING_REVIEW or VERIFIED', () => {
    expect(() => assertCanSubmitForVerification(VerificationStatus.PENDING_REVIEW)).toThrow(AppError);
    expect(() => assertCanSubmitForVerification(VerificationStatus.VERIFIED)).toThrow(AppError);
  });

  it('allows an admin decision only from PENDING_REVIEW', () => {
    expect(() =>
      assertValidVerificationDecision(VerificationStatus.PENDING_REVIEW, VerificationStatus.VERIFIED),
    ).not.toThrow();
    expect(() => assertValidVerificationDecision(VerificationStatus.UNVERIFIED, VerificationStatus.VERIFIED)).toThrow(AppError);
    expect(() => assertValidVerificationDecision(VerificationStatus.VERIFIED, VerificationStatus.REJECTED)).toThrow(AppError);
  });
});
