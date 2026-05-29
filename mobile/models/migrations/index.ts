// Migration registry (M4.2). Append new migrations here, in version order.

import { MIGRATION_001 } from './001_initial';
import { MIGRATION_002 } from './002_session_completed';
import { MIGRATION_003 } from './003_session_overrun';
import type { Migration } from './types';

export type { Migration };

/** All migrations, ascending by version. db.ts runs each one > the DB's
 *  current PRAGMA user_version. */
export const MIGRATIONS: Migration[] = [
  MIGRATION_001,
  MIGRATION_002,
  MIGRATION_003,
].sort((a, b) => a.version - b.version);

/** The version a fully-migrated DB lands on. */
export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;
