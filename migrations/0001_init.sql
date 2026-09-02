-- Provider-domain schema. Owns provider profiles, lifecycle/verification
-- state, a small controlled skills catalog, which services a provider
-- offers (by service_id — servora-services owns the Service entity itself),
-- provider service areas, and provider availability. No auth, booking,
-- payment, or review data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Needed for the GiST exclusion constraint on availability_weekly_slots
-- (equality on uuid/smallint columns combined with a range overlap check).
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE provider_status AS ENUM ('PENDING_ONBOARDING', 'ACTIVE', 'PAUSED', 'DISABLED');
CREATE TYPE verification_status AS ENUM ('UNVERIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED');
CREATE TYPE skill_status AS ENUM ('ACTIVE', 'INACTIVE');

-- One row per Servora user (servora-auth `users.id`, referenced by value
-- only — no cross-database foreign key) who has created a provider profile.
-- Authentication, email, password, and Google identity all remain owned by
-- servora-auth; this table only ever stores the opaque user_id plus
-- provider-domain facts.
CREATE TABLE providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  slug TEXT NOT NULL,
  bio TEXT,
  profile_photo_url TEXT,
  years_experience SMALLINT,
  business_name TEXT,
  -- Small, provider-declared list of language codes (e.g. {en, hi}) rather
  -- than a join table: there is no controlled catalog or per-language
  -- metadata to store, and a native typed array keeps this simple without
  -- being an arbitrary JSON blob.
  languages TEXT[] NOT NULL DEFAULT '{}',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status provider_status NOT NULL DEFAULT 'PENDING_ONBOARDING',
  verification_status verification_status NOT NULL DEFAULT 'UNVERIFIED',
  -- Admin-internal only; never returned on a public or provider-self DTO.
  verification_notes TEXT,
  verification_reviewed_by UUID,
  verification_reviewed_at TIMESTAMPTZ,
  disabled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT providers_user_id_unique UNIQUE (user_id),
  CONSTRAINT providers_slug_unique UNIQUE (slug),
  CONSTRAINT providers_years_experience_range CHECK (years_experience IS NULL OR years_experience BETWEEN 0 AND 100),
  CONSTRAINT providers_languages_length CHECK (array_length(languages, 1) IS NULL OR array_length(languages, 1) <= 20),
  CONSTRAINT providers_disabled_reason_required CHECK (status <> 'DISABLED' OR disabled_reason IS NOT NULL)
);

CREATE INDEX providers_status_idx ON providers (status);
CREATE INDEX providers_verification_status_idx ON providers (verification_status);

-- Controlled, provider-domain-owned skill vocabulary (admin managed) so a
-- future Booking service can match on a stable skill_id rather than
-- free-text strings like "AC Technician" vs "ac technician".
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status skill_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT skills_slug_unique UNIQUE (slug)
);

CREATE INDEX skills_status_idx ON skills (status);

CREATE TABLE provider_skills (
  provider_id UUID NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider_id, skill_id)
);

CREATE INDEX provider_skills_skill_id_idx ON provider_skills (skill_id);

-- Which services (servora-services `services.id`, referenced by value only)
-- a provider offers, plus provider-owned facts about that offering. This
-- never duplicates the Service entity itself (name, description, booking
-- mode, category, service-level pricing configuration all stay in
-- servora-services).
CREATE TABLE provider_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  service_id UUID NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Provider-specific indicative price. Same non-authoritative caveat as
  -- servora-services' base_price_amount: never a charge amount, never
  -- trusted by a payment flow. NULL/NULL or both set together.
  price_amount NUMERIC(12, 2),
  price_currency TEXT,
  experience_years SMALLINT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT provider_services_provider_service_unique UNIQUE (provider_id, service_id),
  CONSTRAINT provider_services_price_amount_non_negative CHECK (price_amount IS NULL OR price_amount >= 0),
  CONSTRAINT provider_services_price_currency_format CHECK (price_currency IS NULL OR price_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT provider_services_price_pair CHECK ((price_amount IS NULL) = (price_currency IS NULL)),
  CONSTRAINT provider_services_experience_years_range CHECK (experience_years IS NULL OR experience_years BETWEEN 0 AND 100)
);

CREATE INDEX provider_services_provider_id_idx ON provider_services (provider_id);
CREATE INDEX provider_services_service_id_idx ON provider_services (service_id);

-- Where a provider is willing to serve customers. Normalized fields
-- (never arbitrary location JSON) so this can be indexed and queried by a
-- future Booking/matching service, e.g. "is Provider X eligible to serve
-- this city/postal code". Coordinates + radius are optional, for future
-- distance-based matching.
CREATE TABLE service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  country_code CHAR(2) NOT NULL,
  region TEXT,
  city TEXT NOT NULL,
  postal_code TEXT,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  radius_km NUMERIC(6, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT service_areas_country_code_format CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT service_areas_radius_positive CHECK (radius_km IS NULL OR radius_km > 0),
  CONSTRAINT service_areas_radius_requires_coordinates
    CHECK (radius_km IS NULL OR (latitude IS NOT NULL AND longitude IS NOT NULL))
);

CREATE INDEX service_areas_provider_id_idx ON service_areas (provider_id);
CREATE INDEX service_areas_city_idx ON service_areas (city);
CREATE INDEX service_areas_postal_code_idx ON service_areas (postal_code);
-- Functional unique index (rather than a plain UNIQUE constraint) because
-- Postgres treats NULLs as distinct in a regular UNIQUE constraint, which
-- would let a provider add the same country/region/city/(no postal code)
-- area more than once.
CREATE UNIQUE INDEX service_areas_provider_area_unique
  ON service_areas (provider_id, country_code, coalesce(region, ''), city, coalesce(postal_code, ''));

-- Recurring weekly availability: "generally, I work Mon 09:00-17:00".
-- day_of_week: 0 = Sunday .. 6 = Saturday (JavaScript Date#getDay convention).
CREATE TABLE availability_weekly_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT availability_weekly_slots_day_range CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT availability_weekly_slots_time_order CHECK (end_time > start_time),
  -- Application-level overlap checking is inherently racy under concurrent
  -- writes to the same provider's schedule; this GiST exclusion constraint
  -- is the actual guard against two overlapping slots on the same day.
  CONSTRAINT availability_weekly_slots_no_overlap EXCLUDE USING gist (
    provider_id WITH =,
    day_of_week WITH =,
    int4range(
      (EXTRACT(EPOCH FROM start_time))::int,
      (EXTRACT(EPOCH FROM end_time))::int,
      '[)'
    ) WITH &&
  )
);

CREATE INDEX availability_weekly_slots_provider_id_idx ON availability_weekly_slots (provider_id);

-- One-off exceptions to the recurring weekly schedule for a specific
-- calendar date: either "unavailable all day" or "special hours this day".
-- This is a provider's general statement of intent, not a booking-slot
-- reservation system — servora-booking owns whether a specific booking can
-- actually be placed at a specific time.
CREATE TABLE availability_date_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  is_unavailable BOOLEAN NOT NULL DEFAULT true,
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT availability_date_overrides_provider_date_unique UNIQUE (provider_id, override_date),
  CONSTRAINT availability_date_overrides_hours_consistency CHECK (
    (is_unavailable AND start_time IS NULL AND end_time IS NULL)
    OR (NOT is_unavailable AND start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

CREATE INDEX availability_date_overrides_provider_id_idx ON availability_date_overrides (provider_id);
CREATE INDEX availability_date_overrides_date_idx ON availability_date_overrides (override_date);
