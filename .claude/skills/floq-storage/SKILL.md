---
name: floq-storage
description: Use this skill whenever the user asks Claude to write, modify, or review anything that touches Floq's ON-DEVICE storage — MMKV (prefs, atomic JSON blobs, caches) or expo-sqlite (queryable session/task history).
Triggers include "MMKV", "SQLite", "expo-sqlite", "local storage", "migration", "schema.sql", "task store", "useTaskStore", "session persistence", "offline", "persist", "cache", or any file under mobile/models/,
mobile/services/storage/, mobile/services/tasks/persist.ts, or mobile/stores/. Do NOT use for Firestore/cloud reads or writes — that's the `floq-firestore` skill. Local is the source of truth; Firestore is an async mirror.
---

# Floq Storage — on-device persistence skill

Floq is **local-first**. The device is the source of truth; Firestore (see `floq-firestore`) is an async mirror for cross-device sync. Two local stores, used for different shapes of data.

## Before you write any storage code

1. Read this whole skill.
2. If it queryable history or aggregation → SQLite. If it's a small pref or a whole-object blob read at startup → MMKV. See the decision table below.
3. If you're adding a SQLite table or column, **write a migration — never edit `schema.sql` in place** (root `CLAUDE.md` safety rule).
4. For the task queue specifically, the feature spec is `shared/spec/task-queue.md` and the decision of record is `decisions.md` L14.

## MMKV vs SQLite vs Firestore

| Need | Store | Why |
|---|---|---|
| Theme override, `has_seen_intro`, onboarding seed | **MMKV** | Tiny, read synchronously at cold start (no flash of wrong state) |
| One whole object read/written atomically (onboarding answers, task queue pre-W4) | **MMKV** | Single JSON blob, atomic write, no query needed |
| LLM parse cache | **MMKV** | Keyed by hash, derived, non-PII |
| Firebase Auth persistence | **MMKV** | Via the MMKV adapter (L13) — avoids `@react-native-async-storage` |
| Session history, task queue (W4+), anything you filter/sort/aggregate | **SQLite** | Queryable; powers stats aggregations (M4.3) |
| Cross-device sync, friends-visible summaries | **Firestore** | Network mirror — see `floq-firestore` |
Rule of thumb: **MMKV for "read the whole thing fast," SQLite for "query a slice."**

## MMKV conventions

- All keys are namespaced `floq.*`. Keep a single registry (below) — don't scatter string literals.
- Blobs are written **atomically** (one `set` of a serialized object), so a kill mid-write never leaves a half-record.
- MMKV is **synchronous** — safe to read during the first render. Use it for anything that would otherwise cause a flash of wrong UI.

### Known MMKV keys (keep this current)

| Key | Owner | Contents |
|---|---|---|
| theme override | S1.2 | `'light' \| 'dark' \| null` |
| `floq.onboarding` | M2.2 | onboarding answers blob |
| `floq.has_seen_intro` | S2.5 | mirror of `users.has_seen_intro` |
| `floq.llmCache.{sha256}` | M2.3 (L12) | cached parse results |
| `floq.tasks` | M2.5 | task queue blob (source of truth until W4) |
| (auth keys via adapter) | M2.4 (L13) | Firebase Auth session, via `services/firebase/authStorage.ts` |

### Sign-out teardown (per L13)

`signOut()` resets Zustand stores and clears app MMKV keys, but **preserves `floq.llmCache.*`** — it's derived, non-PII, and survives account switches.

## SQLite conventions

- Schema lives in `mobile/models/schema.sql`; types in `mobile/models/`.
- **Migrations are append-only and numbered**: `mobile/models/migrations/001_initial.ts`, `002_*.ts`, … Run them on app start, track the applied version. **Never edit a shipped migration or `schema.sql` in place** (root `CLAUDE.md` safety rule) — add a new migration.
- CRUD lives in a service layer, not in screens: `services/storage/sessions.ts`, `services/storage/tasks.ts`. Screens never touch SQLite directly.
- Tables (M4.2): `sessions`, `tasks`, `distractions`.
- Reads that feed the UI are memoized via **TanStack Query** (keys are arrays, per `mobile/CLAUDE.md`), e.g. `getRecentSessions(20)`, the stats aggregations in M4.3.

  ## The MMKV → SQLite handoff (task queue)

  The task store (`useTaskStore`) keeps a **stable API** across the move; only the backing store changes:

  - **W2 (M2.5):** Zustand store backed by the `floq.tasks` MMKV blob. MMKV is the source of truth.
  - **W4 (M4.2):** SQLite becomes the source of truth via `services/storage/tasks.ts`; MMKV **demotes to a fast-read cache**; the store API and its tests are unchanged; tasks mirror async to Firestore `users/{uid}/tasks`.

  When you do this swap: keep `services/tasks/queue.ts` (the pure logic) untouched — only the persistence adapter behind the store changes.

  ## Mirroring to Firestore

  - Always write **local first**, then mirror **async**. Never block the UI on a network write.
  - A failed mirror must not lose the local write — reconcile on next sync, don't throw away SQLite truth.
  - What gets mirrored and its access rules live in the `floq-firestore` skill. Privacy invariant: **task titles never leave the device to friends/`social`** (L4).

  ## Performance notes

  - MMKV reads are sync and cheap — fine on the render path. SQLite reads are not — wrap them in TanStack Query, never call them inline in a component.
  - No SQLite or MMKV work on the session timer's tick path (the tick is Reanimated, off the JS thread — `mobile/CLAUDE.md`).

  ## Things to ask before

  - Editing `schema.sql` or a shipped migration in place (forbidden — write a new migration).
  - Adding a new SQLite table or a new `floq.*` MMKV namespace.
  - Changing which store is the source of truth for an existing data type.
  - Moving anything PII (task titles, raw brain-dump text) into a synced or shared store.

  A few notes on choices I made:

  - Description triggers are tuned to not collide with floq-firestore (which explicitly disclaims MMKV/SQLite) — they fire on mobile/models/, services/storage/, services/tasks/persist.ts, stores/, and the storage keywords.
  - It encodes the frozen safety rule (never edit the SQLite schema in place) and the L13/L12 specifics (MMKV auth adapter, llmCache preservation on sign-out) so the skill stays consistent with locked decisions.
  - It documents the MMKV→SQLite handoff explicitly, since that's the trickiest part of M4.2 and the thing most likely to be done wrong later.