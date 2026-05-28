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
users/{uid}/social                 Single doc — partner-visible profile summary (per L18)

partnerships/{pairId}              ✅ Phase A (M7.0, per L18) — the 1:1 focus-partner edge
partner_invites/{inviteId}         ✅ Phase A (M7.0, per L18)

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
| `privacy` | `'friends' \| 'private'` | ✅ | **Default `'private'` on signup.** The `'friends'` literal is a legacy name (pre-L18); M7.0 renames it to `'partner'` (data + code), since under the partnership model the value gates partner-visibility, not a friend list. |
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

Privacy: **never readable by your partner.** Only the derived `social` summary is partner-visible (L18 / `floq-firestore` rule #3). Task titles are private (L4).

## `users/{uid}/social` ✅

The partner-visible profile summary (per L18). Readable by your **active focus partner** (one at a time). **Never write task titles here.** Updated on session end.

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

## `partnerships/{pairId}` + `partner_invites/{inviteId}` ✅ Phase A (M7.0, per L18)

**O5 is resolved by supersession (L18):** the social graph is the **1:1 focus-partner edge**, not an n:n friend graph. Shapes below are the **v1 design — finalized in M7.0**, which also adds the security rules. The old n:n `friendships` / `friend_requests` are dropped from the spec; revert path is git history (pre-`spec/social-core-pivot`), per L18.

`partnerships/{pairId}` — `pairId = sorted(uidA, uidB).join('_')`, one doc per pair:

| Field | Type | Required | Notes |
|---|---|---|---|
| `members` | string[2] | ✅ | the two UIDs (sorted) |
| `status` | `'pending' \| 'active' \| 'ended'` | ✅ | |
| `created_at` | Timestamp | ✅ | |
| `pair_streak_days` | number | ✅ | gentle design — grace periods; a partner's flake never nukes individual streaks (L16/L17) |

`partner_invites/{inviteId}` — pending invite, sender → recipient:

| Field | Type | Required | Notes |
|---|---|---|---|
| `from_uid` | string | ✅ | sender |
| `to_identifier` | string | ✅ | recipient email or username |
| `status` | `'pending' \| 'accepted' \| 'declined'` | ✅ | accept → creates the partnership |
| `created_at` | Timestamp | ✅ | |

**Access (rules land in M7.0):** a partner may READ the other's completed-session **summaries** + **scheduled** sessions (minutes / score / when) — **NEVER task titles** (L4 invariant holds). Partner visibility is **opt-in at pairing**, shown plainly, and revoked by ending the partnership (M7.0 acceptance). Phase A stays on-device-friendly; only Phase B (stranger-matching, out of MVP scope, conditional on the W8 market read) would require sharing derived data server-side. Until M7.0, `backend/firestore.rules` stays owner-only.
