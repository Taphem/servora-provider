/**
 * A uniqueness/foreign-key/exclusion pre-check in the service layer is
 * inherently racy under concurrent writes, so the database's own
 * constraints are the real guard. These type guards let the service layer
 * map a Postgres constraint violation to the right domain AppError instead
 * of leaking a raw database error to the client.
 */
interface PgError {
  code?: string;
  constraint?: string;
}

export function isUniqueViolation(error: unknown): error is PgError {
  return typeof error === 'object' && error !== null && (error as PgError).code === '23505';
}

export function isForeignKeyViolation(error: unknown): error is PgError {
  return typeof error === 'object' && error !== null && (error as PgError).code === '23503';
}

export function isExclusionViolation(error: unknown): error is PgError {
  return typeof error === 'object' && error !== null && (error as PgError).code === '23P01';
}

export function isCheckViolation(error: unknown): error is PgError {
  return typeof error === 'object' && error !== null && (error as PgError).code === '23514';
}
