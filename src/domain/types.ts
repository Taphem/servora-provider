export const ProviderStatus = {
  // Profile created; not yet visible to customers. The only status a newly
  // created provider row can have.
  PENDING_ONBOARDING: 'PENDING_ONBOARDING',
  // Live and eligible to be considered for marketplace matching (subject to
  // also being VERIFIED — see eligibility.ts).
  ACTIVE: 'ACTIVE',
  // Provider-initiated: "I'm not taking work right now." Reversible by the
  // provider themselves via the activate action.
  PAUSED: 'PAUSED',
  // Admin-initiated: permanently/internally disabled (policy violation,
  // fraud, etc). Only an admin can move a provider out of this state.
  DISABLED: 'DISABLED',
} as const;
export type ProviderStatus = (typeof ProviderStatus)[keyof typeof ProviderStatus];

export const VerificationStatus = {
  UNVERIFIED: 'UNVERIFIED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
} as const;
export type VerificationStatus = (typeof VerificationStatus)[keyof typeof VerificationStatus];

export const SkillStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export type SkillStatus = (typeof SkillStatus)[keyof typeof SkillStatus];

export interface Provider {
  id: string;
  userId: string;
  displayName: string;
  slug: string;
  bio: string | null;
  profilePhotoUrl: string | null;
  yearsExperience: number | null;
  businessName: string | null;
  languages: string[];
  timezone: string;
  status: ProviderStatus;
  verificationStatus: VerificationStatus;
  verificationNotes: string | null;
  verificationReviewedBy: string | null;
  verificationReviewedAt: Date | null;
  disabledReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Skill {
  id: string;
  name: string;
  slug: string;
  status: SkillStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderSkill {
  providerId: string;
  skillId: string;
  createdAt: Date;
}

export interface ProviderService {
  id: string;
  providerId: string;
  serviceId: string;
  isEnabled: boolean;
  priceAmount: string | null;
  priceCurrency: string | null;
  experienceYears: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceArea {
  id: string;
  providerId: string;
  countryCode: string;
  region: string | null;
  city: string;
  postalCode: string | null;
  latitude: string | null;
  longitude: string | null;
  radiusKm: string | null;
  createdAt: Date;
}

export interface WeeklyAvailabilitySlot {
  id: string;
  providerId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  createdAt: Date;
}

export interface AvailabilityDateOverride {
  id: string;
  providerId: string;
  overrideDate: string;
  isUnavailable: boolean;
  startTime: string | null;
  endTime: string | null;
  createdAt: Date;
  updatedAt: Date;
}
