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
users/{uid}/social/summary         Doc — partner-visible session summary projection (M7.1; consent-gated)
users/{uid}/social/profile         Doc — partner-visible sanitized display name (M7.1; isPartner-gated)
users/{uid}/partner/current        Singleton pointer doc — the user's one active pairing (M7.0)
users/{uid}/reactions/{reactorUid} ✅ M7.2 — fire/clap a partner left on this user's finished session

presence/{uid}                     ✅ M7.1 — coarse live presence (consent-gated partner read)
partnerships/{pairId}              ✅ Phase A (M7.0, per L18) — the 1:1 focus-partner edge
partner_invites/{inviteId}         ✅ Phase A (M7.0, per L18) — inviteId === the 6-char code
analytics_events/{eventId}         ✅ M7.2 — always-on first-party funnel sink (create-only, uid-linked)

llm_cache/{hash}                   Shared LLM result cache (🧪 M2.3)

training_samples/{autoId}          🧪 Anonymized ML training samples (L23) — opt-in, create-only
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
| `privacy` | `'partner' \| 'private'` | ✅ | **Default `'private'` on signup.** Renamed from the legacy `'friends'` literal in M7.0 (data + code); under the partnership model the value names partner-visibility, not a friend list. NOTE: visibility is gated by the `partnerships` edge (the `isPartner()` rule), not by this field — it is descriptive, not load-bearing. |
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
| `members` | string[2] | ✅ | the two UIDs, **sorted ascending** (same order as `pairId`) |
| `status` | `'pending' \| 'active' \| 'ended'` | ✅ | `acceptInvite` creates directly as `'active'` (lands paired immediately, S7.0). `'pending'` is reserved (unused in M7.0). `'ended'` set by REMOVE/BLOCK (L30). |
| `created_at` | Timestamp | ✅ | `serverTimestamp()` |
| `pair_streak_days` | number | ✅ | seed `0`. Gentle design — grace periods; a partner's flake never nukes individual streaks (L16/L17) |
| `invite_code` | string | ✅ | **provenance** — the code that created the pair. Lets the partnership-CREATE rule self-address the already-committed invite without a query (rules can't see sibling writes in the same commit) |
| `share_consent` | map<uid,bool> | ✅ | M7.1 — each member's own key = "is MY focus data (summary + presence) visible to my partner". Empty `{}` at create (default-OFF, L28); a member toggles ONLY their own key. Gates `social/summary` + `presence` reads (NOT `social/profile` — identity is visible once paired). |
| `blocked_by` | string | — | set with `status:'ended'` on BLOCK; names the blocker (L30) |
| `ended_at` | Timestamp | — | set on REMOVE/BLOCK |

`partner_invites/{inviteId}` — **`inviteId === the normalized 6-char code`** (typed-code install-and-pair; the recipient is unknown at invite time, so the code itself is the secret that *addresses* the invite — an O(1) `get`, never a query):

| Field | Type | Required | Notes |
|---|---|---|---|
| `code` | string | ✅ | the normalized 6-char code; **equals the doc id** |
| `from_uid` | string | ✅ | inviter (issuer) UID |
| `status` | `'pending' \| 'accepted' \| 'revoked' \| 'expired'` | ✅ | created `'pending'`; accept → `'accepted'`; issuer revoke → `'revoked'` |
| `accepted_by` | string | — | stamped with the accepter's UID on accept |
| `created_at` | Timestamp | ✅ | `serverTimestamp()` |
| `expires_at` | Timestamp | ✅ | absolute, `created_at + ≤72h` (a Timestamp, not a TTL, so rules can compare `request.time < expires_at`) |

`users/{uid}/partner/current` — **singleton pointer doc**: this doc existing (or not) IS the "one partner at a time" invariant. Deleted on REMOVE/BLOCK.

| Field | Type | Required | Notes |
|---|---|---|---|
| `pair_id` | string | ✅ | the `pairId` this user is bound to |
| `partner_uid` | string | ✅ | the other member (denormalized so the partner tab reads the counterpart's `social/summary` without first reading the partnership) |
| `since` | Timestamp | ✅ | `serverTimestamp()` |
| `invite_code` | string | ✅ | provenance; addresses the invite for the cross-tree pairing-grant rule |

`presence/{uid}` ✅ M7.1 — coarse live presence (owner write/delete; consent-gated partner read). Timestamps are epoch-ms **numbers** so the client (`derivePresence`) can clamp freshness; staleness is NOT a rule concern.

| Field | Type | Required | Notes |
|---|---|---|---|
| `state` | `'focusing' \| 'idle' \| 'just_finished'` | ✅ | `focusing` on session start; `just_finished` on a completed Done; `idle` on sign-out |
| `phase` | Phase | — | current/end phase (struggle/release/flow/recovery) |
| `started_at` | number (ms) | — | load-bearing for the `focusing` staleness clamp (≤90+5 min) |
| `ended_at` | number (ms) | — | load-bearing for the `just_finished` decay (~30 min) |
| `score` / `minutes` | number | — | coarse finish stats on `just_finished` |

`users/{uid}/social/summary` ✅ M7.1 — the title-stripped session projection. **Structurally no `task`/`title` key.** Writer is owner-self on session-end (Done and saved partials).

| Field | Type | Required | Notes |
|---|---|---|---|
| `minutes` | number | ✅ | actual focus minutes |
| `focus_score` | number | ✅ | may be negative |
| `ended_at` | Timestamp | ✅ | |
| `phase_at_end` | Phase | ✅ | |

`users/{uid}/social/profile` ✅ M7.1 — the partner-visible sanitized display name (length-capped, control-char-stripped, phone/URL/slur → "Floq user"). Projected on createInvite + acceptInvite + display-name edit (each member projects their OWN). Owner-write only.

| Field | Type | Required | Notes |
|---|---|---|---|
| `display_name` | string | ✅ | sanitized projection of `users/{uid}.display_name` — never the raw value |
| `updated_at` | Timestamp | ✅ | |

`users/{ownerUid}/reactions/{reactorUid}` ✅ M7.2 — a one-tap reaction the REACTOR left on the OWNER's finished session. Doc id = the reactor's uid (a re-react overwrites → idempotent, one live reaction per direction). The owner reads their own `reactions/*`; the reactor writes cross-tree into the owner's tree.

| Field | Type | Required | Notes |
|---|---|---|---|
| `kind` | `'fire' \| 'clap'` | ✅ | |
| `reacted_at` | Timestamp | ✅ | `serverTimestamp()` (the rule asserts it equals request.time) |
| `session_ended_at` | Timestamp | ✅ | anchors to the specific finished session (the summary is a singleton that gets overwritten) |

`analytics_events/{eventId}` ✅ M7.2 — the always-on first-party funnel instrument (the W8 Axis-A read). `eventId = "${uid}:${seq}"` (deterministic → idempotent re-send). **uid-LINKED and create-only / NOT wiped** — deliberately distinct from the anonymous L23 `training_samples`. NO titles / free text / display name (L4): `name` is a bounded enum, `props` a shallow primitive map.

| Field | Type | Required | Notes |
|---|---|---|---|
| `uid` | string | ✅ | must equal the writer (`request.auth.uid`) |
| `name` | string | ✅ | a funnel event name (bounded, ≤64) |
| `ts` | number | ✅ | capture-time epoch ms (offline-truthful, NOT a server clock) |
| `seq` | number | ✅ | per-device monotonic counter |
| `kind` | string | ✅ | optional category (≤32) |
| `props` | map | ✅ | shallow primitive map (≤16 keys); NO free text |

**Access (rules in M7.0 + M7.1 + M7.2, `backend/firestore.rules`):**
- `partner_invites/{code}`: `get` by code for any signed-in user (the code is the secret); no `list` (no enumeration); issuer creates/revokes; the accepter flips it to `accepted`.
- `partnerships/{pairId}`: read/update by `members` only. **CREATE (release-gate A)** is a client transaction (Spark / no cloud function) gated on a valid committed invite from the counterpart + both members' pointers absent — proven **under the 10-`get()`/rule cap** by an emulator test. Members may flip `active → ended` (REMOVE/BLOCK, L30).
- `users/{uid}/social/summary` + `presence/{uid}`: an **active partner WITH consent** may READ (release-gate B + M7.1 `partnerCanRead`) — minutes / score / when / live state, **NEVER task titles** (L4 holds); `sessions`, `tasks`, the raw user doc, and the partner pointer stay partner-DENIED. Consent is the owner's own `share_consent` key (default-OFF).
- `users/{uid}/social/profile`: an **active partner** reads the sanitized NAME via `isPartner()` **without** consent (per L28 the consent flag covers focus *activity*, not identity — you can see a partner's name once paired).
- `users/{uid}/partner/current`: owner-writable; plus two narrow cross-tree grants — a **pairing** grant (the accepter creates the counterpart's pointer, gated on a valid invite) and the **L30 unpair** grant (a member deletes the pointer that names them, to end the partnership).
- `users/{uid}/reactions/{reactorUid}` (M7.2): the reactor cross-tree creates/updates their own reaction gated on `partnerCanRead` (you can only react to a session you're allowed to see); reactor-delete is **ungated** (so a reactor cleans up after unpair — `endPartnership` uses this). The owner reads their received reactions via the recursive grant. These cross-tree writes (pairing pointer, unpair pointer, reaction) are the only writes a user makes outside their own tree.
- `analytics_events/{eventId}` (M7.2): create-only, `uid == auth.uid`, strict shape; no read/update/delete from any client. **Always-on** (no consent gate) and **not wiped** (create-only by design, like `training_samples`, but uid-linked).

Phase A stays on-device-friendly; only Phase B (stranger-matching, out of MVP scope, conditional on the W8 market read) would require sharing derived data server-side.

## `training_samples/{autoId}` 🧪 (L23)

Anonymized ML training samples for retraining the mature timer model. **Top-level + unlinked to any account on purpose** (anonymous, not personal data — see L23). **Opt-in only** (`settings.telemetryConsent`, default OFF); uploaded best-effort at session-save time **only while consent is ON**. Auto-id (no meaningful key).

**Hard invariant: no identifiers, no free text.** No `uid`, no email, no display name, no task title, no task id — **L4 holds** (titles never leave the device). Only the normalized model input + scalar outcomes + version tags.

| Field | Type | Required | Notes |
|---|---|---|---|
| `features` | number[13] | ✅ | normalized model input vector (`ml/MODEL_SPEC.md`) — floats only, no text |
| `focus_score` | number | ✅ | realized outcome (training label); may be negative |
| `actual_focus_minutes` | number | ✅ | realized focus minutes |
| `planned_focus_minutes` | number | ✅ | the plan's suggestion |
| `task_completed` | boolean | ✅ | did the session finish the task? Resolved on the recovery screen (L19, *after* save) — the strongest outcome label. Defaults `false`; `true` if Mark-task-done is tapped in this session's recovery flow |
| `regime` | `'cold' \| 'warming' \| 'mature'` | ✅ | which engine produced the plan |
| `model_version` | string | ✅ | **always set** (no dirty data): `cold → 'formula-v1'`, `warming → 'warming-v1'`, `mature → MODEL_VERSION` |
| `client_version` | string | ✅ | provenance |
| `created_at` | Timestamp | ✅ | `serverTimestamp()` |

**Access:** **create-only** for any authenticated client, with strict shape validation (only the keys above; `features` a 13-length list); **no read / update / delete** from clients (`backend/firestore.rules`). Retraining reads it offline via the Firebase Admin SDK (service account, bypasses rules) — no cloud function (Spark, L13 pattern). Cloud Function + App Check for attested anti-spam writes is a pre-public-launch upgrade (L23 revisit).
