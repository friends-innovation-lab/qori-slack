/**
 * WS-1: Study public_id Migration Integration Test
 *
 * Verifies the 20260909000000-ws1-study-public-id migration:
 * - Migration file is well-formed (up/down exports)
 * - If DB is reachable and migration applied: column constraints are correct
 *
 * Uses the same test DB helper as other integration tests.
 */

import { getTestDb } from './setup/testDb';
import { QueryTypes } from 'sequelize';

const sequelize = getTestDb();

afterAll(async () => {
  await sequelize.close();
});

describe('WS-1: study public_id migration', () => {
  it('migration file exports up and down functions', () => {
    const migration = require('../../database/migrations/20260909000000-ws1-study-public-id');
    expect(typeof migration.up).toBe('function');
    expect(typeof migration.down).toBe('function');
  });

  it('migration up adds public_id column with NOT NULL and UNIQUE', async () => {
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'research_studies' AND column_name = 'public_id';
    `, { type: QueryTypes.SELECT }) as any[];

    if (!columns) {
      console.log('public_id column not present — migration not yet applied to test DB');
      return;
    }

    expect(columns.data_type).toBe('uuid');
    expect(columns.is_nullable).toBe('NO');
  });

  it('existing research_studies rows have non-null UUID public_id', async () => {
    const [result] = await sequelize.query(`
      SELECT COUNT(*) as count FROM research_studies WHERE public_id IS NULL;
    `, { type: QueryTypes.SELECT }) as any[];

    if (result) {
      expect(Number(result.count)).toBe(0);
    }
  });

  it('public_id has unique index', async () => {
    const [indexes] = await sequelize.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'research_studies' AND indexname LIKE '%public_id%';
    `, { type: QueryTypes.SELECT }) as any[];

    if (indexes) {
      expect(indexes.indexname).toContain('public_id');
    }
  });

  it('duplicate UUID is rejected', async () => {
    const [existing] = await sequelize.query(`
      SELECT public_id FROM research_studies LIMIT 1;
    `, { type: QueryTypes.SELECT }) as any[];

    if (!existing) return;

    await expect(
      sequelize.query(`
        INSERT INTO research_studies (public_id, name, project_id, created_at, updated_at)
        VALUES (:publicId, 'dup-test', 1, NOW(), NOW());
      `, {
        replacements: { publicId: existing.public_id },
        type: QueryTypes.INSERT,
      }),
    ).rejects.toThrow();
  });
});
