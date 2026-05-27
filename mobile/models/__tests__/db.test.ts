import { describe, it, expect, beforeEach, vi } from 'vitest';

// Back expo-sqlite with a real in-memory better-sqlite3 (see test/expoSqliteFake).
vi.mock('expo-sqlite', () => import('../../test/expoSqliteFake'));

import { resetExpoSqliteFake } from '../../test/expoSqliteFake';
import { getDb } from '../db';
import { LATEST_VERSION } from '../migrations';

beforeEach(() => {
  resetExpoSqliteFake();
});

describe('db migrations', () => {
  it('migrates a fresh DB to the latest schema version', () => {
    const db = getDb();
    const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
    expect(row?.user_version).toBe(LATEST_VERSION);
  });

  it('creates the tasks, sessions, and distractions tables', () => {
    const tables = getDb()
      .getAllSync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'")
      .map((t) => t.name);
    expect(tables).toEqual(expect.arrayContaining(['tasks', 'sessions', 'distractions']));
  });

  it('is idempotent: repeated getDb() calls keep the version and data intact', () => {
    getDb().runSync(
      'INSERT INTO tasks (id, title, difficulty, est_minutes, "order", done, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      'a',
      'A',
      3,
      30,
      0,
      0,
      1,
    );
    getDb();
    getDb();
    expect(getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM tasks')?.n).toBe(1);
    expect(
      getDb().getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version,
    ).toBe(LATEST_VERSION);
  });
});
