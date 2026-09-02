import type {
  AvailabilityDateOverride,
  Provider,
  ProviderService,
  ProviderStatus,
  ServiceArea,
  Skill,
  SkillStatus,
  VerificationStatus,
  WeeklyAvailabilitySlot,
} from '../domain/types.js';

interface ProviderRow {
  id: string;
  user_id: string;
  display_name: string;
  slug: string;
  bio: string | null;
  profile_photo_url: string | null;
  years_experience: number | null;
  business_name: string | null;
  languages: string[] | null;
  timezone: string;
  status: string;
  verification_status: string;
  verification_notes: string | null;
  verification_reviewed_by: string | null;
  verification_reviewed_at: Date | null;
  disabled_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export function mapProviderRow(row: ProviderRow): Provider {
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    slug: row.slug,
    bio: row.bio,
    profilePhotoUrl: row.profile_photo_url,
    yearsExperience: row.years_experience,
    businessName: row.business_name,
    languages: row.languages ?? [],
    timezone: row.timezone,
    status: row.status as ProviderStatus,
    verificationStatus: row.verification_status as VerificationStatus,
    verificationNotes: row.verification_notes,
    verificationReviewedBy: row.verification_reviewed_by,
    verificationReviewedAt: row.verification_reviewed_at,
    disabledReason: row.disabled_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface SkillRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export function mapSkillRow(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status as SkillStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ProviderServiceRow {
  id: string;
  provider_id: string;
  service_id: string;
  is_enabled: boolean;
  price_amount: string | null;
  price_currency: string | null;
  experience_years: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export function mapProviderServiceRow(row: ProviderServiceRow): ProviderService {
  return {
    id: row.id,
    providerId: row.provider_id,
    serviceId: row.service_id,
    isEnabled: row.is_enabled,
    priceAmount: row.price_amount,
    priceCurrency: row.price_currency,
    experienceYears: row.experience_years,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ServiceAreaRow {
  id: string;
  provider_id: string;
  country_code: string;
  region: string | null;
  city: string;
  postal_code: string | null;
  latitude: string | null;
  longitude: string | null;
  radius_km: string | null;
  created_at: Date;
}

export function mapServiceAreaRow(row: ServiceAreaRow): ServiceArea {
  return {
    id: row.id,
    providerId: row.provider_id,
    countryCode: row.country_code,
    region: row.region,
    city: row.city,
    postalCode: row.postal_code,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusKm: row.radius_km,
    createdAt: row.created_at,
  };
}

interface WeeklyAvailabilitySlotRow {
  id: string;
  provider_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: Date;
}

export function mapWeeklyAvailabilitySlotRow(row: WeeklyAvailabilitySlotRow): WeeklyAvailabilitySlot {
  return {
    id: row.id,
    providerId: row.provider_id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    createdAt: row.created_at,
  };
}

interface AvailabilityDateOverrideRow {
  id: string;
  provider_id: string;
  override_date: string;
  is_unavailable: boolean;
  start_time: string | null;
  end_time: string | null;
  created_at: Date;
  updated_at: Date;
}

export function mapAvailabilityDateOverrideRow(row: AvailabilityDateOverrideRow): AvailabilityDateOverride {
  return {
    id: row.id,
    providerId: row.provider_id,
    overrideDate: row.override_date,
    isUnavailable: row.is_unavailable,
    startTime: row.start_time,
    endTime: row.end_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
