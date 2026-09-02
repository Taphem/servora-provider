import type { DbPool } from '../pool.js';
import { mapSkillRow } from '../rowMappers.js';
import type { Skill } from '../../domain/types.js';

export async function listSkillsForProvider(pool: DbPool, providerId: string): Promise<Skill[]> {
  const result = await pool.query(
    `SELECT sk.* FROM skills sk
     JOIN provider_skills psk ON psk.skill_id = sk.id
     WHERE psk.provider_id = $1
     ORDER BY sk.name ASC`,
    [providerId],
  );
  return result.rows.map(mapSkillRow);
}

/**
 * Replaces a provider's entire skill set atomically — mirroring how
 * servora-services replaces a service's requirement fields as one array —
 * so a provider editing their skills can't leave the set in a
 * partially-applied state between calls.
 */
export async function replaceProviderSkills(pool: DbPool, providerId: string, skillIds: string[]): Promise<Skill[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM provider_skills WHERE provider_id = $1', [providerId]);

    for (const skillId of skillIds) {
      await client.query('INSERT INTO provider_skills (provider_id, skill_id) VALUES ($1, $2)', [providerId, skillId]);
    }

    const result = await client.query(
      `SELECT sk.* FROM skills sk
       JOIN provider_skills psk ON psk.skill_id = sk.id
       WHERE psk.provider_id = $1
       ORDER BY sk.name ASC`,
      [providerId],
    );

    await client.query('COMMIT');
    return result.rows.map(mapSkillRow);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
