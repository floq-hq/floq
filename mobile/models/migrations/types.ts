// SQLite migration shape (M4.2).
//
// Migrations are append-only and numbered. `up` is a single SQL string of one
// or more statements run inside a transaction; `version` is the schema version
// it brings the DB to (tracked via PRAGMA user_version). See models/db.ts.

export interface Migration {
  version: number;
  up: string;
}
