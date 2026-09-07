import type { DbPool } from '../pool.js';
import { mapSkillRow } from '../rowMappers.js';
import type { Skill, SkillStatus } from '../../domain/types.js';

export interface InsertSkillParams {
  name: string;
  slug: string;
  status: SkillStatus;
}

export async function insertSkill(pool: DbPool, params: InsertSkillParams): Promise<Skill> {
  const result = await pool.query(
    `INSERT INTO skills (name, slug, status) VALUES ($1, $2, $3) RETURNING *`,
    [params.name, params.slug, params.status],
  );
  return mapSkillRow(result.rows[0]);
}

export async function findSkillById(pool: DbPool, id: string): Promise<Skill | undefined> {
  const result = await pool.query('SELECT * FROM skills WHERE id = $1', [id]);
  return result.rows[0] ? mapSkillRow(result.rows[0]) : undefined;
}

export async function findSkillBySlug(pool: DbPool, slug: string): Promise<Skill | undefined> {
  const result = await pool.query('SELECT * FROM skills WHERE slug = $1', [slug]);
  return result.rows[0] ? mapSkillRow(result.rows[0]) : undefined;
}

export async function findSkillsByIds(pool: DbPool, ids: string[]): Promise<Skill[]> {
  if (ids.length === 0) {
    return [];
  }
  const result = await pool.query('SELECT * FROM skills WHERE id = ANY($1)', [ids]);
  return result.rows.map(mapSkillRow);
}

export interface ListSkillsFilter {
  includeInactive: boolean;
  limit: number;
  offset: number;
}

export async function listSkills(pool: DbPool, filter: ListSkillsFilter): Promise<{ rows: Skill[]; total: number }> {
  const whereClause = filter.includeInactive ? '' : `WHERE status = 'ACTIVE'`;

  const countResult = await pool.query<{ count: string }>(`SELECT count(*) FROM skills ${whereClause}`);
  const total = Number(countResult.rows[0]?.count ?? 0);

  const dataResult = await pool.query(
    `SELECT * FROM skills ${whereClause} ORDER BY name ASC LIMIT $1 OFFSET $2`,
    [filter.limit, filter.offset],
  );

  return { rows: dataResult.rows.map(mapSkillRow), total };
}

export interface UpdateSkillParams {
  name?: string;
  slug?: string;
  status?: SkillStatus;
}

const COLUMN_BY_FIELD: Record<keyof UpdateSkillParams, string> = {
  name: 'name',
  slug: 'slug',
  status: 'status',
};

export async function updateSkill(pool: DbPool, id: string, patch: UpdateSkillParams): Promise<Skill | undefined> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  for (const [field, column] of Object.entries(COLUMN_BY_FIELD) as [keyof UpdateSkillParams, string][]) {
    if (patch[field] !== undefined) {
      setClauses.push(`${column} = $${i++}`);
      values.push(patch[field]);
    }
  }

  setClauses.push('updated_at = now()');
  values.push(id);

  const result = await pool.query(`UPDATE skills SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`, values);
  return result.rows[0] ? mapSkillRow(result.rows[0]) : undefined;
}
