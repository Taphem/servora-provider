import { AppError } from '../errors/AppError.js';
import { ErrorCode } from '../errors/errorCodes.js';
import { ProviderStatus, VerificationStatus } from './types.js';

export type StatusActor = 'provider' | 'admin';

/**
 * Explicit provider-status state machine (see README "Provider lifecycle"
 * for the rationale against a bag of unrelated booleans). Distinct from
 * verification and from marketplace eligibility, which are separate
 * concerns modeled elsewhere (verification below; eligibility.ts).
 *
 *               activate           activate
 *  PENDING_ONBOARDING ───────► ACTIVE ◄──────── PAUSED
 *          │                     │  │              ▲
 *          │  admin              │  └── pause ──────┘
 *          ▼  disable            ▼
 *        DISABLED ◄────────────────  (admin: any state -> DISABLED)
 *          │
 *          └── admin reactivate/reset ──► ACTIVE | PENDING_ONBOARDING
 */
const STATUS_TRANSITIONS: Record<ProviderStatus, Partial<Record<ProviderStatus, StatusActor[]>>> = {
  [ProviderStatus.PENDING_ONBOARDING]: {
    [ProviderStatus.ACTIVE]: ['provider', 'admin'],
    [ProviderStatus.DISABLED]: ['admin'],
  },
  [ProviderStatus.ACTIVE]: {
    [ProviderStatus.PAUSED]: ['provider', 'admin'],
    [ProviderStatus.DISABLED]: ['admin'],
  },
  [ProviderStatus.PAUSED]: {
    [ProviderStatus.ACTIVE]: ['provider', 'admin'],
    [ProviderStatus.DISABLED]: ['admin'],
  },
  [ProviderStatus.DISABLED]: {
    [ProviderStatus.ACTIVE]: ['admin'],
    [ProviderStatus.PENDING_ONBOARDING]: ['admin'],
  },
};

export function assertValidStatusTransition(current: ProviderStatus, target: ProviderStatus, actor: StatusActor): void {
  const allowedActors = STATUS_TRANSITIONS[current]?.[target];
  if (!allowedActors || !allowedActors.includes(actor)) {
    throw new AppError({
      statusCode: 409,
      code: ErrorCode.INVALID_STATUS_TRANSITION,
      message: `Cannot transition provider status from ${current} to ${target}.`,
    });
  }
}

/**
 * Verification is a distinct concern from provider status (see README
 * "Verification"). A provider submits for review; only an admin decides
 * the outcome, and only from PENDING_REVIEW — an admin cannot fast-track a
 * VERIFIED decision without a submission on record.
 *
 *   UNVERIFIED ──submit──► PENDING_REVIEW ──admin: approve──► VERIFIED
 *        ▲                       │
 *        │                admin: reject
 *        │                       ▼
 *        └──────────────────  REJECTED ──submit (resubmit)──► PENDING_REVIEW
 */
const VERIFICATION_SUBMIT_FROM = new Set<VerificationStatus>([VerificationStatus.UNVERIFIED, VerificationStatus.REJECTED]);

export function assertCanSubmitForVerification(current: VerificationStatus): void {
  if (!VERIFICATION_SUBMIT_FROM.has(current)) {
    throw new AppError({
      statusCode: 409,
      code: ErrorCode.INVALID_VERIFICATION_TRANSITION,
      message: `Cannot submit for verification from status ${current}.`,
    });
  }
}

export function assertValidVerificationDecision(
  current: VerificationStatus,
  target: typeof VerificationStatus.VERIFIED | typeof VerificationStatus.REJECTED,
): void {
  if (current !== VerificationStatus.PENDING_REVIEW) {
    throw new AppError({
      statusCode: 409,
      code: ErrorCode.INVALID_VERIFICATION_TRANSITION,
      message: `Cannot record a verification decision (${target}) from status ${current}; the provider must be PENDING_REVIEW.`,
    });
  }
}
