import type { DbPool } from '../pool.js';
import { mapProviderRow } from '../rowMappers.js';
import type { Provider, ProviderStatus, VerificationStatus } from '../../domain/types.js';

export interface InsertProviderParams {
  userId: string;
  displayName: string;
  slug: string;
  bio: string | null;
  profilePhotoUrl: string | null;
  yearsExperience: number | null;
  businessName: string | null;
  languages: string[];
  timezone: string;
}

export async function insertProvider(pool: DbPool, params: InsertProviderParams): Promise<Provider> {
  const result = await pool.query(
    `INSERT INTO providers (
       user_id, display_name, slug, bio, profile_photo_url, years_experience,
       business_name, languages, timezone
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      params.userId,
      params.displayName,
      params.slug,
      params.bio,
      params.profilePhotoUrl,
      params.yearsExperience,
      params.businessName,
      params.languages,
      params.timezone,
    ],
  );
  return mapProviderRow(result.rows[0]);
}

export async function findProviderById(pool: DbPool, id: string): Promise<Provider | undefined> {
  const result = await pool.query('SELECT * FROM providers WHERE id = $1', [id]);
  return result.rows[0] ? mapProviderRow(result.rows[0]) : undefined;
}

export async function findProviderBySlug(pool: DbPool, slug: string): Promise<Provider | undefined> {
  const result = await pool.query('SELECT * FROM providers WHERE slug = $1', [slug]);
  return result.rows[0] ? mapProviderRow(result.rows[0]) : undefined;
}

export async function findProviderByUserId(pool: DbPool, userId: string): Promise<Provider | undefined> {
  const result = await pool.query('SELECT * FROM providers WHERE user_id = $1', [userId]);
  return result.rows[0] ? mapProviderRow(result.rows[0]) : undefined;
}

export interface ListProvidersFilter {
  status?: ProviderStatus;
  verificationStatus?: VerificationStatus;
  city?: string;
  countryCode?: string;
  serviceId?: string;
  skillId?: string;
  limit: number;
  offset: number;
}

export async function listProviders(pool: DbPool, filter: ListProvidersFilter): Promise<{ rows: Provider[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (filter.status !== undefined) {
    conditions.push(`p.status = $${i++}`);
    values.push(filter.status);
  }
  if (filter.verificationStatus !== undefined) {
    conditions.push(`p.verification_status = $${i++}`);
    values.push(filter.verificationStatus);
  }
  if (filter.serviceId !== undefined) {
    conditions.push(
      `EXISTS (SELECT 1 FROM provider_services ps WHERE ps.provider_id = p.id AND ps.service_id = $${i++} AND ps.is_enabled)`,
    );
    values.push(filter.serviceId);
  }
  if (filter.skillId !== undefined) {
    conditions.push(`EXISTS (SELECT 1 FROM provider_skills sk WHERE sk.provider_id = p.id AND sk.skill_id = $${i++})`);
    values.push(filter.skillId);
  }
  if (filter.city !== undefined) {
    conditions.push(`EXISTS (SELECT 1 FROM service_areas sa WHERE sa.provider_id = p.id AND sa.city = $${i++})`);
    values.push(filter.city);
  }
  if (filter.countryCode !== undefined) {
    conditions.push(`EXISTS (SELECT 1 FROM service_areas sa WHERE sa.provider_id = p.id AND sa.country_code = $${i++})`);
    values.push(filter.countryCode);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query<{ count: string }>(`SELECT count(*) FROM providers p ${whereClause}`, values);
  const total = Number(countResult.rows[0]?.count ?? 0);

  const dataValues = [...values, filter.limit, filter.offset];
  const dataResult = await pool.query(
    `SELECT p.* FROM providers p ${whereClause} ORDER BY p.created_at DESC, p.id ASC LIMIT $${i++} OFFSET $${i}`,
    dataValues,
  );

  return { rows: dataResult.rows.map(mapProviderRow), total };
}

export interface UpdateProviderParams {
  displayName?: string;
  slug?: string;
  bio?: string | null;
  profilePhotoUrl?: string | null;
  yearsExperience?: number | null;
  businessName?: string | null;
  languages?: string[];
  timezone?: string;
  status?: ProviderStatus;
  disabledReason?: string | null;
  verificationStatus?: VerificationStatus;
  verificationNotes?: string | null;
  verificationReviewedBy?: string | null;
  verificationReviewedAt?: Date | null;
}

const COLUMN_BY_FIELD: Record<keyof UpdateProviderParams, string> = {
  displayName: 'display_name',
  slug: 'slug',
  bio: 'bio',
  profilePhotoUrl: 'profile_photo_url',
  yearsExperience: 'years_experience',
  businessName: 'business_name',
  languages: 'languages',
  timezone: 'timezone',
  status: 'status',
  disabledReason: 'disabled_reason',
  verificationStatus: 'verification_status',
  verificationNotes: 'verification_notes',
  verificationReviewedBy: 'verification_reviewed_by',
  verificationReviewedAt: 'verification_reviewed_at',
};

export async function updateProvider(pool: DbPool, id: string, patch: UpdateProviderParams): Promise<Provider | undefined> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  for (const [field, column] of Object.entries(COLUMN_BY_FIELD) as [keyof UpdateProviderParams, string][]) {
    if (patch[field] !== undefined) {
      setClauses.push(`${column} = $${i++}`);
      values.push(patch[field]);
    }
  }

  if (setClauses.length === 0) {
    return findProviderById(pool, id);
  }

  setClauses.push(`updated_at = now()`);
  values.push(id);

  const result = await pool.query(`UPDATE providers SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`, values);
  return result.rows[0] ? mapProviderRow(result.rows[0]) : undefined;
}
