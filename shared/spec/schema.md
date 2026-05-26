# Floq Firestore schema

> Source of truth for the Firestore data model (M1.4). Mirrors the document
> shapes in the `floq-firestore` skill. When you add a collection or field,
> update **both** this file and the skill. Security rules live in
> `backend/firestore.rules`; the access principles they enforce are in the
> `floq-firestore` skill.

Legend: ✅ defined · 🧪 provisional (finalized by a later task) · ⏳ deferred (decision open)

## Collection layout

```
users/{uid}                        Single user document
users/{uid}/sessions/{sessionId}   Subcollection — completed sessions (append-only)
users/{uid}/tasks/{taskId}         Subcollection — current task queue (mirror of SQLite)
users/{uid}/social                 Single doc — friends-visible profile summary

friendships/{pairId}               ⏳ PENDING O5 (M7.1)
friend_requests/{requestId}        ⏳ PENDING O5 (M7.1)

llm_cache/{hash}                   Shared LLM result cache (🧪 M2.3)
```

All timestamps are Firestore `Timestamp`; write server timestamps (`serverTimestamp()`), not client clocks.

## `users/{uid}` ✅

One doc per user, keyed by Firebase Auth UID. Created on first sign-up (M2.4).

| Field | Type | Required | Notes |
|---|---|---|---|
| `uid` | string | ✅ | Matches the doc id / Auth UID |
| `email` | string | ✅ | |
| `display_name` | string | ✅ | |
| `apple_id` | string | — | Set only for Apple Sign-In users |
| `created_at` | Timestamp | ✅ | Server timestamp at sign-up |
| `has_seen_intro` | boolean | ✅ | First-session framing card; default `false` |
| `privacy` | `'friends' \| 'private'` | ✅ | **Default `'private'` on signup** |
| `onboarding` | map | — | Set when onboarding completes (M1.5) |

`onboarding` map:

| Field | Type | Required | Notes |
|---|---|---|---|
| `base_focus` | number | ✅ | minutes, 10–90 |
| `distraction_level` | `'easy' \| 'neutral' \| 'hard'` | ✅ | |
| `preferred_time` | `'morning' \| 'afternoon' \| 'evening'` | ✅ | |
| `use_case` | `'studying' \| 'work' \| 'creative' \| 'coding'` | ✅ | |
| `completed_at` | Timestamp | ✅ | |

## `users/{uid}/sessions/{sessionId}` ✅

**Append-only. Never edit a completed session.** Written on session end (M3.2 / M4.2), mirrored from SQLite.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✅ | Matches doc id |
| `started_at` | Timestamp | ✅ | |
| `ended_at` | Timestamp | ✅ | |
| `planned_focus_minutes` | number | ✅ | From the `SessionPlan` |
| `actual_focus_minutes` | number | ✅ | |
| `break_minutes` | number | ✅ | |
| `distraction_count` | number | ✅ | |
| `distraction_timestamps` | Timestamp[] | ✅ | May be empty |
| `task` | map | ✅ | `{ title: string; difficulty: 1–5; est_minutes: number }` |
| `focus_score` | number | ✅ | **Can be negative** — not clamped |
| `regime` | `'cold' \| 'warming' \| 'mature'` | ✅ | |
| `client_version` | string | ✅ | |
| `model_version` | string | — | Set only when `regime === 'mature'` |

Privacy: **never readable by friends.** Task titles are private.

## `users/{uid}/social` ✅

The only doc friends can read — and only when both users have `privacy: 'friends'` and a friendship exists. **Never write task titles here.** Updated on session end (M7.2, via cloud function).

| Field | Type | Required | Notes |
|---|---|---|---|
| `display_name` | string | ✅ | |
| `current_streak_days` | number | ✅ | |
| `weekly_focus_score` | number | ✅ | Recomputed on a schedule (cloud function) |
| `last_session_at` | Timestamp | ✅ | |
| `last_session_minutes` | number | ✅ | |
| `last_session_score` | number | ✅ | |
| `updated_at` | Timestamp | ✅ | |

## `users/{uid}/tasks/{taskId}` ✅

Current task queue, **mirror of the SQLite tasks table** (canonical schema: `mobile/models/schema.sql`, M4.2). Owner-only (no friend read; never written to `social`). Written client-side, async, on every queue change — one-way push diff (upsert current queue, delete removed ids); no cloud function. Source of truth: SQLite (`mobile/services/storage/tasks.ts`); the MMKV blob is a fast-read cache.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✅ | Matches doc id |
| `title` | string | ✅ | Private — never synced to `social` |
| `difficulty` | 1–5 | ✅ | |
| `est_minutes` | number | ✅ | |
| `order` | number | ✅ | Queue position |
| `created_at` | Timestamp | ✅ | |
| `done` | boolean | — | Defaults `false` |

## `llm_cache/{hash}` 🧪 provisional

Shared, derived cache of LLM task-parse results, keyed by an input hash (the hash includes `use_case` but **no raw user text**). Readable/writeable by any authenticated user. Owned by M2.3; finalize then.

| Field | Type | Required | Notes |
|---|---|---|---|
| `hash` | string | ✅ | Matches doc id |
| `use_case` | string | ✅ | Part of the hash input |
| `parsed` | array | ✅ | Parsed task objects (zod-validated client-side) |
| `created_at` | Timestamp | ✅ | For TTL / eviction later |

## `friendships/{pairId}` + `friend_requests/{requestId}` ⏳ PENDING O5 (M7.1)

**Not defined — O5 is still open** in `shared/spec/decisions.md`. Do not write these collections until O5 is locked. Options on the table:

- **(a) Bidirectional doc** — `friendships/{uid_a}_{uid_b}` with sorted UIDs; one write per pair. Cheaper, harder to list "my friends."
- **(b) Subcollection** — `users/{uid}/friends/{friend_uid}`; two writes per add. More standard, simpler queries.

Resolution + final shape land in **M7.1 (Friend graph schema)**, which also adds the per-collection security rules and the friend-request-acceptance cloud function. Until then, `backend/firestore.rules` denies all client access.
