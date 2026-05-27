// Test-only fake for expo-sqlite, backed by a real in-memory better-sqlite3
// database (M4.2). expo-sqlite is a native module that can't load under vitest's
// node environment, so tests `vi.mock('expo-sqlite', () => require(this))`. Using
// a real SQLite engine means migrations, ORDER BY, COUNT, and PRAGMA
// user_version all execute for real — the tests catch actual SQL bugs.
//
// Call resetExpoSqliteFake() in beforeEach for a pristine DB per test. The
// adapter object is stable (db.ts memoizes its handle); its methods read the
// current better-sqlite3 instance, which reset swaps out.

import Database from 'better-sqlite3';

let current: Database.Database = new Database(':memory:');

/** Fresh in-memory DB (user_version 0, no tables). Use in beforeEach. */
export function resetExpoSqliteFake(): void {
  try {
    current.close();
  } catch {
    // already closed — fine
  }
  current = new Database(':memory:');
}

/** expo-sqlite passes params as variadics or as a single array; normalize. */
function flatten(params: unknown[]): unknown[] {
  if (params.length === 1 && Array.isArray(params[0])) return params[0] as unknown[];
  return params;
}

const adapter = {
  execSync(source: string): void {
    current.exec(source);
  },
  runSync(source: string, ...params: unknown[]) {
    const info = current.prepare(source).run(...(flatten(params) as never[]));
    return { lastInsertRowId: Number(info.lastInsertRowid), changes: info.changes };
  },
  getFirstSync<T>(source: string, ...params: unknown[]): T | null {
    return (current.prepare(source).get(...(flatten(params) as never[])) as T) ?? null;
  },
  getAllSync<T>(source: string, ...params: unknown[]): T[] {
    return current.prepare(source).all(...(flatten(params) as never[])) as T[];
  },
  withTransactionSync(task: () => void): void {
    current.transaction(task)();
  },
};

/** Stands in for expo-sqlite's openDatabaseSync. */
export function openDatabaseSync(): typeof adapter {
  return adapter;
}
