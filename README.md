# Servora Provider

Provider-domain service for the Servora marketplace. It owns the provider side of the marketplace: who a provider is (as a business/professional operating on Servora), their lifecycle/verification state, what services they offer, what skills they have, where they operate, and when they generally work. It does not own authentication, the service catalog itself, bookings, payments, or reviews.

## Ownership

**Owns:**
- Provider profile (display name, bio, photo, experience, business name, languages, timezone)
- Provider lifecycle status (`PENDING_ONBOARDING` / `ACTIVE` / `PAUSED` / `DISABLED`) and verification state (`UNVERIFIED` / `PENDING_REVIEW` / `VERIFIED` / `REJECTED`)
- A small controlled skills catalog and each provider's skill associations
- Which `servora-services` services a provider offers, and provider-specific facts about that offering (price, experience, notes, enabled/disabled)
- Provider service areas (country/region/city/postal code, optional coordinates + radius)
- Provider availability (recurring weekly schedule + date-specific overrides)
- Computed marketplace eligibility (a provider-side fact, not a matching decision)

**Explicitly does not own** (each belongs to a sibling domain service):
- User identity, credentials, sessions, Google auth → `servora-auth`
- Service/category definitions, booking mode, service-level pricing configuration → `servora-services`
- Bookings, scheduling, provider matching/dispatch → `servora-booking` (not yet implemented)
- Payments, commissions, payouts, refunds → `servora-payment` (not yet implemented)
- Reviews/ratings → `servora-review` (not yet implemented)
- Notification delivery → `servora-notification`

This service never writes to another domain's tables, never proxies another domain's business logic, and never implements matching/dispatch — it only exposes the provider-side facts a future `servora-booking` would consult.

## Stack

TypeScript (strict, ESM) on Node.js ≥24, **Fastify 5**, **PostgreSQL** via the raw `pg` driver (no ORM), **Zod** for request validation, **Pino** for logging, **Vitest** for tests. Deliberately matches `servora-services`'/`servora-auth`'s conventions (folder layout, error envelope, migration runner, plugin structure, request-identity trust model) so the pattern is familiar across Servora backend services.

## Relationship to Auth: referencing, not duplicating, identity

`servora-auth` remains the sole source of truth for identity — email, password, Google identity, sessions. This service never stores any of that. A provider row stores only `user_id`, an opaque foreign reference to `servora-auth`'s `users.id` *by value* (no cross-database foreign key — see "Database ownership"):

```
servora-auth:      User    id = abc123 (email, password hash, role, ...)
servora-provider:  Provider id = xyz789, user_id = abc123 (display name, bio, ...)
```

### Authorization role mapping (a documented discrepancy)

`servora-docs/01-product/user-roles.md` describes a conceptual `PROVIDER` role ("a service professional/business that offers services through Servora"). However, `servora-auth`'s actually-implemented `UserRole` enum (`src/types/domain.ts`) has no `PROVIDER` value — its roles are `CUSTOMER`, `BUSINESS_OWNER`, `BUSINESS_STAFF`, `ADMIN`, `SUPER_ADMIN`, `SUPPORT`. Per the platform rule "do not invent a new authentication role if one is already established," this service treats **`BUSINESS_OWNER`** as the role that may create and self-manage a provider profile (see `src/middleware/identity.ts`), since that is the role the identity provider actually issues for a service-offering account.

**Known limitation:** `BUSINESS_STAFF` cannot currently act on a `BUSINESS_OWNER`'s provider profile. Resource-scoped staff-to-business permissions were called out in `servora-auth`'s own README as belonging to a Business service, which does not exist yet. Until that ownership-delegation mechanism exists somewhere in the platform, a provider profile is 1:1 with a single `BUSINESS_OWNER` `user_id`.

## Domain model

```
providers
  id, user_id (unique, servora-auth reference only), display_name, slug (unique),
  bio, profile_photo_url, years_experience, business_name, languages (text[]),
  timezone, status (PENDING_ONBOARDING|ACTIVE|PAUSED|DISABLED),
  verification_status (UNVERIFIED|PENDING_REVIEW|VERIFIED|REJECTED),
  verification_notes, verification_reviewed_by, verification_reviewed_at,  -- admin-internal
  disabled_reason, created_at, updated_at

skills                        -- small controlled catalog, admin-managed
  id, name, slug (unique), status (ACTIVE|INACTIVE), created_at, updated_at

provider_skills                -- provider <-> skill associations
  provider_id, skill_id, created_at

provider_services               -- which servora-services service_id a provider offers
  id, provider_id, service_id (external reference, no FK), is_enabled,
  price_amount, price_currency, experience_years, notes, created_at, updated_at

service_areas
  id, provider_id, country_code, region, city, postal_code,
  latitude, longitude, radius_km, created_at

availability_weekly_slots       -- recurring "generally, I work Mon 09:00-17:00"
  id, provider_id, day_of_week (0=Sun..6=Sat), start_time, end_time, created_at

availability_date_overrides     -- one-off exceptions for a specific calendar date
  id, provider_id, override_date, is_unavailable, start_time, end_time, created_at, updated_at
```

See `migrations/0001_init.sql` for the full set of constraints, indexes, and the rationale comments on each (e.g. why languages is a native array rather than a join table, why service area uniqueness uses a functional index, why weekly-slot overlap is enforced by a GiST exclusion constraint rather than only application code).

### Provider lifecycle

Deliberately an explicit state machine (`src/domain/lifecycle.ts`), not a bag of unrelated booleans:

```
              activate           activate
 PENDING_ONBOARDING ──────► ACTIVE ◄──────── PAUSED
         │                    │  │              ▲
         │  admin              │  └── pause ──────┘
         ▼  disable            ▼
       DISABLED ◄────────────────  (admin: any state -> DISABLED, requires a reason)
         │
         └── admin reactivate/reset ──► ACTIVE | PENDING_ONBOARDING
```

A provider may only ever `activate` (self) or `pause` (self); disabling is admin-only and requires a reason. This distinguishes four business facts that a single `isActive` flag would collapse: *has created a profile* (row exists, status starts `PENDING_ONBOARDING`), *is temporarily unavailable* (`PAUSED`, reversible by the provider), *is permanently/internally disabled* (`DISABLED`, admin-only), and *is verified* (a wholly separate concern — see below).

### Verification

Verification is **not authentication** — it is a provider-domain trust/compliance concern, independent of `status`:

```
  UNVERIFIED ──submit──► PENDING_REVIEW ──admin approve──► VERIFIED
       ▲                       │
       │                admin reject
       │                       ▼
       └──────────────────  REJECTED ──submit (resubmit)──► PENDING_REVIEW
```

An admin can only record a VERIFIED/REJECTED decision from `PENDING_REVIEW` — there is always a submission on record before a decision. No document upload/KYC-provider integration exists yet; `verification_notes`/`verification_reviewed_by`/`verification_reviewed_at` are plain admin-internal metadata columns, never returned on a public or provider-self DTO except `verification_notes` (shown to the provider so they know why they were rejected — see "Public profile vs private data"). If document evidence is needed later, it belongs in object storage with only a pointer/key stored here, per the platform's storage-strategy guidance — not implemented, left as a clean extension point.

### Marketplace eligibility

`GET /api/v1/providers/:idOrSlug/eligibility` (`src/domain/eligibility.ts`) is a **computed fact, always derived fresh, never cached or stored**: `status = ACTIVE` AND `verificationStatus = VERIFIED` AND at least one enabled service offering AND at least one service area. This is provider-side eligibility only — an input a future `servora-booking` matching/dispatch decision would consult. This service has no concept of a specific booking request, ranking, or "who gets offered this job first"; it only ever answers "does this provider satisfy the marketplace's baseline participation requirements right now?"

### Skills

A small, provider-domain-owned controlled catalog (admin-managed `skills` table) rather than free text, so a future `servora-booking` can match on a stable `skill_id` instead of comparing strings like `"AC Technician"` vs `"ac technician"`. Deliberately not an elaborate taxonomy/hierarchy — just id/name/slug/status, the minimum a matching consumer needs.

### Services offered

A provider offers a `servora-services` service by its `service_id` — **the Service entity itself is never duplicated** here (no local name/description/category/booking-mode copy). Adding or updating an offering validates the referenced `service_id` against `servora-services` at write time (see "Services integration" below); reads never re-validate, so an offering row always reflects what was true when the provider added/edited it. Provider-owned facts about the offering: `is_enabled`, an optional provider-specific indicative price (never authoritative — same caveat as `servora-services`' `base_price_amount`), experience years, and notes.

### Service areas

Normalized, indexed columns (country/region/city/postal code, optional lat/long + radius) rather than an arbitrary location JSON blob, so a future `servora-booking` can query "is Provider X eligible to serve this city/postal code" efficiently. Coordinates + radius are optional and exist purely as an extension point for future distance-based matching — this service does no distance math itself today.

### Availability

Answers **"when does this provider generally say they can work?"** — not "is this provider free for *this specific* booking at *this specific* time," which is `servora-booking`'s job once it exists. Two layers:
- **Recurring weekly slots** (`availability_weekly_slots`): e.g. "Mon 09:00–17:00." Replaced as a whole array per PUT (same atomic-replace pattern `servora-services` uses for requirement fields), so an edit can't leave a half-updated week visible mid-request. A `GiST` exclusion constraint is the authoritative guard against two overlapping slots on the same day (app-level validation in the Zod schema gives a friendlier error first, but the constraint is what actually prevents a race).
- **Date overrides** (`availability_date_overrides`): one-off exceptions for a specific calendar date — either "unavailable all day" or "special hours this day" — addressed by date (`PUT/DELETE .../availability/overrides/:date`), since a calendar date is already a natural, idempotent key.

This service deliberately does **not** implement booking-slot reservation/locking — that is `servora-booking`'s responsibility once it exists.

### Pricing

Provider-specific pricing (`provider_services.price_amount`/`price_currency`) is **indicative only, never authoritative** — the same caveat `servora-services`' `base_price_amount` carries. No payment-provider coupling exists here; the authoritative charge amount belongs to `servora-payment`/`servora-booking`.

## Services integration (servora-services)

Isolated behind one module, `src/clients/servicesClient.ts` — nothing else in this codebase makes an outbound HTTP call. Called directly against `servora-services`' own base URL (its catalog read endpoint is public/unauthenticated), not through the API Gateway, since this is a server-to-server read rather than a request on behalf of an end user. No shared database, no cross-database foreign key.

Every upstream failure mode is translated into a clear domain error rather than leaking a raw exception:

| Upstream outcome | This service's response |
| --- | --- |
| 404 / service doesn't exist | `400 UPSTREAM_SERVICE_NOT_FOUND` |
| Service exists but `status != ACTIVE` | `400 UPSTREAM_SERVICE_INACTIVE` |
| Network failure / connection refused | `502 UPSTREAM_SERVICE_UNAVAILABLE` |
| Request timeout (`SERVICES_API_TIMEOUT_MS`) | `504 UPSTREAM_SERVICE_TIMEOUT` |
| Malformed/unexpected response body | `502 UPSTREAM_SERVICE_UNAVAILABLE` |

This validation only happens when a provider adds or edits an offering — reads of a provider's existing offerings never re-call `servora-services`, so this service's own availability is never coupled to `servora-services`' database or uptime for read traffic.

## API

All public routes are versioned under `/api/v1/providers/...`, matching the route prefix reserved for this service in `servora-api-gateway`'s downstream registry (`PROVIDER_SERVICE_URL`, default `http://localhost:4010`; this required a minimal, additive change to `servora-api-gateway/src/config/downstreams.ts` and `.env.example` since no provider route existed yet).

### Public (no authentication required)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/providers` | List providers. Query: `serviceId`, `skillId`, `city`, `countryCode`, `page`, `pageSize`. Only `ACTIVE` providers. |
| GET | `/api/v1/providers/:idOrSlug` | Public profile by UUID or slug. |
| GET | `/api/v1/providers/:idOrSlug/services` | Offered services (enabled only). |
| GET | `/api/v1/providers/:idOrSlug/skills` | Provider's skills. |
| GET | `/api/v1/providers/:idOrSlug/service-areas` | Provider's coverage areas. |
| GET | `/api/v1/providers/:idOrSlug/availability/weekly` | Recurring weekly schedule. |
| GET | `/api/v1/providers/:idOrSlug/availability/overrides` | Date overrides. Query: `from`, `to`. |
| GET | `/api/v1/providers/:idOrSlug/eligibility` | Computed marketplace eligibility (see above). |
| GET | `/api/v1/providers/skills` | The controlled skills catalog (`ACTIVE` only). |

A caller identified as `ADMIN`/`SUPER_ADMIN` additionally sees non-`ACTIVE` providers/offerings/skills on these same endpoints — there is no separate admin-only read surface for single-resource lookups (matching `servora-services`' convention).

### Provider self-service (requires a `BUSINESS_OWNER` identity; always scoped to the caller's own `user_id` — see Authorization)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/v1/providers/me` | Create own profile (one per user). |
| GET / PATCH | `/api/v1/providers/me` | Read/update own profile (private DTO). |
| POST | `/api/v1/providers/me/activate` | `PENDING_ONBOARDING`/`PAUSED` → `ACTIVE`. |
| POST | `/api/v1/providers/me/pause` | `ACTIVE` → `PAUSED`. |
| POST | `/api/v1/providers/me/verification/submit` | `UNVERIFIED`/`REJECTED` → `PENDING_REVIEW`. |
| GET / POST | `/api/v1/providers/me/services` | List / add an offering. |
| PATCH / DELETE | `/api/v1/providers/me/services/:serviceId` | Update / remove an offering (addressed by `service_id`, unique per provider). |
| GET / PUT | `/api/v1/providers/me/skills` | Replace the entire skill set atomically. |
| GET / POST | `/api/v1/providers/me/service-areas` | List / add a service area. |
| DELETE | `/api/v1/providers/me/service-areas/:id` | Remove a service area. |
| GET / PUT | `/api/v1/providers/me/availability/weekly` | Replace the entire weekly schedule atomically. |
| GET | `/api/v1/providers/me/availability/overrides` | List overrides. Query: `from`, `to`. |
| PUT / DELETE | `/api/v1/providers/me/availability/overrides/:date` | Upsert / remove one date's override. |

### Administrative (requires `ADMIN`/`SUPER_ADMIN`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/providers/admin` | List every provider (any status). Query: `status`, `verificationStatus`, `page`, `pageSize`. |
| GET | `/api/v1/providers/admin/:id` | Full admin DTO for one provider. |
| PATCH | `/api/v1/providers/admin/:id/status` | Set status (`reason` required when disabling). |
| PATCH | `/api/v1/providers/admin/:id/verification` | Record `VERIFIED`/`REJECTED` (`notes` required when rejecting). |
| POST | `/api/v1/providers/admin/skills` | Create a skill. |
| PATCH | `/api/v1/providers/admin/skills/:id` | Update a skill (name/status). |

List responses use `{ data: T[], pagination: { page, pageSize, total, totalPages } }`, bounded by `MAX_PAGE_SIZE` (default 100). Errors use the shared Servora envelope: `{ error: { code, message, requestId } }`.

## Authorization

Like every downstream behind the gateway, this service never verifies a session or decodes a JWT itself — it trusts the `x-user-id`/`x-user-role` headers the API Gateway attaches once it has verified the caller's session (`src/middleware/identity.ts`). This is a trust boundary, not a cryptographic guarantee, identical to the model `servora-services`/`servora-auth` already use.

- **Self-service writes** (`/providers/me/...`) require a `BUSINESS_OWNER` identity and are *always* scoped to `request.identity.userId` — there is no route where "which provider to modify" is taken from the URL or request body for a self-service call, so a `BUSINESS_OWNER` cannot modify another provider's data by guessing an id (IDOR is structurally impossible on this surface, not just checked; see `test/integration/authorization.test.ts`).
- **Admin routes** (`/providers/admin/...`) require `ADMIN`/`SUPER_ADMIN` and operate on an explicit `:id` — admins can manage any provider by design.
- **Public reads** never require authentication and never expose private/admin-only fields (see next section).

Missing identity headers → `401 UNAUTHENTICATED`; present but insufficient role → `403 FORBIDDEN`.

## Public profile vs private provider data

Three explicit DTOs (`src/dto/providerDto.ts`), not one object with conditionally-included fields — each route picks the widest DTO its audience is allowed to see, so a field can never leak just because a route forgot to strip it:

- **Public** (`toPublicProviderDto`): id, slug, displayName, bio, profilePhotoUrl, yearsExperience, businessName, languages, status, verificationStatus, createdAt.
- **Private/self** (`toPrivateProviderDto`, adds): userId, timezone, verificationNotes (so a provider can see *why* they were rejected/disabled), disabledReason, updatedAt.
- **Admin** (`toAdminProviderDto`, adds): verificationReviewedBy, verificationReviewedAt — which admin acted and when, never shown to the provider or public.

## Caching strategy

`src/cache/Cache.ts` is a small abstraction with two implementations: `InMemoryCache` (default — fine for local dev and a single instance) and `RedisCache` (used automatically when `REDIS_URL` is set, so multiple instances behind a load balancer share cache state). Redis is never authoritative — PostgreSQL always is.

Applied to exactly one thing: the public single-provider profile read (`GET /providers/:idOrSlug`), with a short TTL, invalidated synchronously on every write to that provider (profile update, status change, verification decision). **Deliberately not applied** to availability, eligibility, verification, or lifecycle status reads — those are read fresh from PostgreSQL on every request, because a stale answer there is a correctness bug (e.g. a customer seeing a disabled provider as bookable), not a performance nuisance worth the risk.

## Database ownership

This service owns its own PostgreSQL database (`servora_provider`, inside the existing Neon `servora` project — never `neondb` or `servora_services`, never a new Neon project) and never reads or writes another service's tables. No cross-database foreign keys exist anywhere in the schema; `user_id` and `service_id` are opaque UUID values validated at the application layer (uniqueness/presence checks, or a live `servora-services` call for `service_id` — see "Services integration"), never database-enforced references into another service's database. Migrations are plain numbered `.sql` files under `/migrations`, applied by the same dependency-free runner `servora-services`/`servora-auth` use (`npm run migrate`), tracked in a `schema_migrations` table.

## Local development

```bash
docker compose up -d      # Postgres on localhost:5434
cp .env.example .env      # DATABASE_URL already points at the compose Postgres
npm install
npm run migrate
npm run dev                # listens on :4010
```

`servora-services` must be reachable at `SERVICES_API_BASE_URL` (default `http://localhost:4004`) for adding/editing service offerings to work; every other endpoint works without it.

## Scripts

`npm run dev` / `build` / `start` / `lint` / `lint:fix` / `typecheck` / `test` / `test:watch` / `migrate`. Integration tests are skipped automatically unless `TEST_DATABASE_URL` is set (see `test/integration/helpers.ts`); they never make a real HTTP call to `servora-services` either — `test/helpers/fakeServicesClient.ts` is an in-memory stand-in injected into the test app.

## Domain events (documented, not implemented)

No message broker exists anywhere in the current Servora architecture (confirmed against `servora-notification` and `servora-docs/02-architecture/event-architecture.md`, which describes one as designed but not deployed — and `servora-services`' README reaches the same conclusion). Events a future subscriber would plausibly need:

- `ProviderCreated`, `ProviderStatusChanged`, `ProviderVerificationChanged` — `{ providerId, userId, status | verificationStatus }`
- `ProviderServiceOffered`, `ProviderServiceWithdrawn` — `{ providerId, serviceId, isEnabled }`

When a real event mechanism is adopted Servora-wide, these should carry minimal, stable-identifier payloads, not full row snapshots — matching `servora-services`' own guidance.

## Future integration points

- **servora-booking**: will read a provider's offerings, skills, service areas, availability, and computed eligibility as inputs to matching/dispatch — this service exposes those facts but implements no ranking, matching, or dispatch logic itself.
- **servora-payment**: owns authoritative charge amounts; this service's provider-specific pricing is reference-only, as documented above.
- **servora-review**: will eventually read provider identity to attach ratings; this service has no review/rating concept.
- **Object storage**: `profile_photo_url` is a plain URL column today (no upload pipeline implemented). Verification documents, if ever required, belong in object storage with only a pointer stored here — an intentional, undeveloped extension point, not an oversight.

## Intentionally not implemented

Per the task boundary, this service does **not** implement: customer bookings, provider matching/dispatch, booking-slot reservations, payments/commissions/refunds/payouts, reviews/ratings, authentication (including phone/SMS login), an ML ranking or recommendation engine, an event bus, or search infrastructure (Elasticsearch etc.) — see "Do not implement" in the original task brief for the full list. Document upload/KYC-provider integration for verification is also not implemented (see "Verification" above) — deliberately left as a clean extension point rather than built speculatively.
#   s e r v o r a - p r o v i d e r  
 