import type { Provider } from '../domain/types.js';

/**
 * Three explicit read models rather than one object with "maybe" fields, so
 * a route can never accidentally leak a private/admin-only field just by
 * forgetting to strip it — see README "Public profile vs private provider
 * data". Each function below is the single place that decides what a given
 * audience may see.
 */
export interface PublicProviderDto {
  id: string;
  slug: string;
  displayName: string;
  bio: string | null;
  profilePhotoUrl: string | null;
  yearsExperience: number | null;
  businessName: string | null;
  languages: string[];
  status: Provider['status'];
  verificationStatus: Provider['verificationStatus'];
  createdAt: string;
}

export interface PrivateProviderDto extends PublicProviderDto {
  userId: string;
  timezone: string;
  // Provider-facing rejection/disable explanations. Deliberately excludes
  // verificationReviewedBy/verificationReviewedAt (which admin acted, and
  // when) — a provider has no legitimate need to see which admin account
  // reviewed them, only the outcome and (if rejected/disabled) why.
  verificationNotes: string | null;
  disabledReason: string | null;
  updatedAt: string;
}

export interface AdminProviderDto extends PrivateProviderDto {
  verificationReviewedBy: string | null;
  verificationReviewedAt: string | null;
}

export function toPublicProviderDto(provider: Provider): PublicProviderDto {
  return {
    id: provider.id,
    slug: provider.slug,
    displayName: provider.displayName,
    bio: provider.bio,
    profilePhotoUrl: provider.profilePhotoUrl,
    yearsExperience: provider.yearsExperience,
    businessName: provider.businessName,
    languages: provider.languages,
    status: provider.status,
    verificationStatus: provider.verificationStatus,
    createdAt: provider.createdAt.toISOString(),
  };
}

export function toPrivateProviderDto(provider: Provider): PrivateProviderDto {
  return {
    ...toPublicProviderDto(provider),
    userId: provider.userId,
    timezone: provider.timezone,
    verificationNotes: provider.verificationNotes,
    disabledReason: provider.disabledReason,
    updatedAt: provider.updatedAt.toISOString(),
  };
}

export function toAdminProviderDto(provider: Provider): AdminProviderDto {
  return {
    ...toPrivateProviderDto(provider),
    verificationReviewedBy: provider.verificationReviewedBy,
    verificationReviewedAt: provider.verificationReviewedAt?.toISOString() ?? null,
  };
}
