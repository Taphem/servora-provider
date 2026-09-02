import { z } from 'zod';

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(150)
  .regex(SLUG_PATTERN, 'slug must be lowercase alphanumeric words separated by single hyphens');

export const uuidSchema = z.string().uuid();

export function buildPaginationQuerySchema(defaultPageSize: number, maxPageSize: number) {
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(maxPageSize).default(defaultPageSize),
  });
}

export const idOrSlugParamSchema = z.object({
  idOrSlug: z.string().trim().min(1).max(150),
});

export const idParamSchema = z.object({
  id: uuidSchema,
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
export const timeSchema = z.string().regex(TIME_PATTERN, 'must be HH:MM or HH:MM:SS (24-hour)');

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const dateSchema = z.string().regex(DATE_PATTERN, 'must be an ISO calendar date, e.g. 2026-10-12');

export const currencyCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'must be a 3-letter ISO 4217 code, e.g. USD');

export const countryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'must be a 2-letter ISO 3166-1 alpha-2 code, e.g. US');

// Intl.DateTimeFormat's own timeZone validation is used rather than
// checking membership in Intl.supportedValuesOf('timeZone'): that list is
// ICU-version-dependent and only contains canonical zone names, so it
// rejects widely-used, still-valid identifiers the runtime otherwise
// accepts fine (e.g. 'UTC', or older aliases like 'Asia/Calcutta').
// Constructing a DateTimeFormat is the authoritative check the runtime
// itself uses to resolve a timezone name.
export const timezoneSchema = z.string().trim().min(1).max(64).refine(isKnownTimezone, 'must be a valid IANA timezone, e.g. Asia/Kolkata');

function isKnownTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const languageCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z]{2}$/, 'must be a 2-letter ISO 639-1 code, e.g. en');
