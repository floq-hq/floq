// SQLite handle + migration runner (M4.2).
//
// The single entry point to the on-device database. Opens floq.db once
// (memoized), then self-migrates on every access via PRAGMA user_version — so
// the schema is always current before any read/write WITHOUT wiring anything
// into app startup (keeps this out of the frontend's app/_layout.tsx). Uses the
// expo-sqlite SYNCHRONOUS API so the storage layer stays synchronous and the
// task store's sync persistence contract is unchanged.
//
// No React. Migrations are append-only (models/migrations/) — never edit a
// shipped one in place (root CLAUDE.md safety rule).

import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { LATEST_VERSION, MIGRATIONS } from './migrations';

const DB_NAME = 'floq.db';

let handle: SQLiteDatabase | null = null;

/** Get the migrated DB handle. Cheap on the steady-state path (one PRAGMA read
 *  once the version is current). */
export function getDb(): SQLiteDatabase {
  if (!handle) {
    handle = openDatabaseSync(DB_NAME);
  }
  // Idempotent, must be set outside a transaction; needed for the distractions
  // ON DELETE CASCADE (SQLite defaults foreign keys OFF).
  handle.execSync('PRAGMA foreign_keys = ON');
  ensureMigrated(handle);
  return handle;
}

/** Run every migration newer than the DB's current user_version, in order,
 *  each in its own transaction (DDL + the version bump commit together). */
function ensureMigrated(db: SQLiteDatabase): void {
  const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version >= LATEST_VERSION) return;

  for (const migration of MIGRATIONS) {
    if (migration.version > version) {
      db.withTransactionSync(() => {
        db.execSync(migration.up);
        // user_version assignment is transactional (DB header) — rolls back
        // with the DDL if anything in `up` throws.
        db.execSync(`PRAGMA user_version = ${migration.version}`);
      });
      version = migration.version;
    }
  }
}
