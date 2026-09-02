import type { DbPool } from '../db/pool.js';
import {
  findSkillById,
  findSkillsByIds,
  insertSkill,
  listSkills as listSkillsQuery,
  updateSkill as updateSkillQuery,
} from '../db/queries/skills.js';
import { listSkillsForProvider, replaceProviderSkills } from '../db/queries/providerSkills.js';
import { isUniqueViolation } from '../errors/dbErrors.js';
import { AppError } from '../errors/AppError.js';
import { ErrorCode } from '../errors/errorCodes.js';
import { SkillStatus, type Skill } from '../domain/types.js';
import { buildPage, paginationOffset, type Page } from '../utils/pagination.js';
import { slugify } from '../utils/slugify.js';
import type { CreateSkillBody, UpdateSkillBody } from '../schemas/skills.js';

function notFoundError(): AppError {
  return new AppError({ statusCode: 404, code: ErrorCode.SKILL_NOT_FOUND, message: 'Skill not found.' });
}

export async function createSkill(pool: DbPool, body: CreateSkillBody): Promise<Skill> {
  const slug = body.slug ?? slugify(body.name);
  try {
    return await insertSkill(pool, { name: body.name, slug, status: body.status });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError({ statusCode: 409, code: ErrorCode.SKILL_SLUG_ALREADY_EXISTS, message: 'A skill with this slug already exists.' });
    }
    throw error;
  }
}

export async function listSkills(pool: DbPool, includeInactive: boolean, page: number, pageSize: number): Promise<Page<Skill>> {
  const { rows, total } = await listSkillsQuery(pool, { includeInactive, limit: pageSize, offset: paginationOffset(page, pageSize) });
  return buildPage(rows, page, pageSize, total);
}

export async function updateSkill(pool: DbPool, id: string, patch: UpdateSkillBody): Promise<Skill> {
  const existing = await findSkillById(pool, id);
  if (!existing) {
    throw notFoundError();
  }

  try {
    const updated = await updateSkillQuery(pool, id, patch);
    if (!updated) {
      throw notFoundError();
    }
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError({ statusCode: 409, code: ErrorCode.SKILL_SLUG_ALREADY_EXISTS, message: 'A skill with this slug already exists.' });
    }
    throw error;
  }
}

export async function getSkillsForProvider(pool: DbPool, providerId: string): Promise<Skill[]> {
  return listSkillsForProvider(pool, providerId);
}

/**
 * Validates every skillId exists and is ACTIVE before replacing the set, so
 * a provider gets one clear 400 rather than a partial write followed by a
 * foreign-key error, and can never associate themselves with a
 * catalog-disabled skill.
 */
export async function replaceProviderSkillSet(pool: DbPool, providerId: string, skillIds: string[]): Promise<Skill[]> {
  if (skillIds.length === 0) {
    return replaceProviderSkills(pool, providerId, []);
  }

  const skills = await findSkillsByIds(pool, skillIds);
  const foundIds = new Set(skills.map((skill) => skill.id));
  const missing = skillIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new AppError({
      statusCode: 400,
      code: ErrorCode.SKILL_NOT_FOUND,
      message: `Unknown skill id(s): ${missing.join(', ')}.`,
    });
  }

  const inactive = skills.filter((skill) => skill.status !== SkillStatus.ACTIVE);
  if (inactive.length > 0) {
    throw new AppError({
      statusCode: 400,
      code: ErrorCode.SKILL_INACTIVE,
      message: `Skill(s) are not active: ${inactive.map((skill) => skill.slug).join(', ')}.`,
    });
  }

  return replaceProviderSkills(pool, providerId, skillIds);
}
