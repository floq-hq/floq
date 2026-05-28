---
name: floq-firestore
description: Use this skill whenever the user asks Claude to write, modify, or review anything that touches Firestore — collections, documents, queries, security rules, social profile sync, partnerships, partner invites, session writes, or onboarding persistence. Triggers include "Firestore", "Firebase", "security rules", "social profile", "partner", "partnership", "pair", "invite", "session sync", "cloud function", or any file under backend/ or mobile/services/firebase/. Do NOT use for SQLite or MMKV work — those are local storage, not Firestore.
---

# Floq Firestore — schema and rules skill

This skill loads the data model and access rules for Floq's backend. Floq's social model is a **1:1 focus partnership** (per `shared/spec/decisions.md` **L18**). Anything that would expose data beyond your one active partner needs explicit approval. The **task-title privacy invariant (L4) is unchanged** — titles never leave the device to a partner.

## Before you write any Firestore code

1. Read this whole skill.
2. Check `shared/spec/decisions.md` for open decisions.
3. If you're adding a new collection, write the schema here first.

## Collection layout

```
users/{uid}                       Single user document.
users/{uid}/sessions/{sessionId}  Subcollection — completed sessions only.
users/{uid}/tasks/{taskId}        Subcollection — current task queue (synced from SQLite).
users/{uid}/social                Single doc — partner-visible profile summary.

partnerships/{pairId}             Per L18: the 1:1 focus-partner edge.
                                  pairId = sorted(uid_a, uid_b).join('_')
partner_invites/{inviteId}        Pending partner invites.

llm_cache/{hash}                  Optional — shared LLM result cache by input hash.
```

Old n:n `friendships` / `friend_requests` are dropped from the active spec (L18 supersedes O5). Revert source is git history (pre-`spec/social-core-pivot`).

## Document shapes

### `users/{uid}`

```ts
{
  uid: string;
  email: string;
  display_name: string;
  apple_id?: string;
  created_at: Timestamp;
  has_seen_intro: boolean;       // first-session framing card
  privacy: 'friends' | 'private'; // default 'private' on signup. NOTE: 'friends' is a legacy name (pre-L18). M7.0 renames it to 'partner' (data + code) since the field gates partner-visibility under the partnership model. See schema.md.
  onboarding: {
    base_focus: number;
    distraction_level: 'easy' | 'neutral' | 'hard';
    preferred_time: 'morning' | 'afternoon' | 'evening';
    use_case: 'studying' | 'work' | 'creative' | 'coding';
    completed_at: Timestamp;
  };
}
```

### `users/{uid}/sessions/{sessionId}`

Append-only. Never edit a completed session.

```ts
{
  id: string;
  started_at: Timestamp;
  ended_at: Timestamp;
  planned_focus_minutes: number;
  actual_focus_minutes: number;
  break_minutes: number;
  distraction_count: number;
  distraction_timestamps: Timestamp[];
  task: { title: string; difficulty: 1|2|3|4|5; est_minutes: number };
  focus_score: number;           // can be negative
  regime: 'cold' | 'warming' | 'mature';
  client_version: string;
  model_version?: string;        // only set if mature
}
```

### `users/{uid}/tasks/{taskId}`

The current task queue. **Owner-only** (security rules #1/#3) — never readable by your partner, never synced to `social`. Mirror of the local SQLite `tasks` table; written client-side and async on change (no cloud function). Source of truth: M2.5 (Zustand + MMKV) → M4.2 (SQLite + this Firestore mirror).

```ts
{
  id: string;
  title: string;                 // PRIVATE — never written to social
  difficulty: 1|2|3|4|5;
  est_minutes: number;
  order: number;                 // queue position
  done: boolean;                 // defaults false
  created_at: Timestamp;
}
```

### `users/{uid}/social`

The only thing your **active focus partner** can read (per L18 + security rule #2 — opt-in at pairing, revoked when partnership ends). Never write task titles here.

```ts
{
  display_name: string;
  current_streak_days: number;
  weekly_focus_score: number;
  last_session_at: Timestamp;
  last_session_minutes: number;
  last_session_score: number;
  updated_at: Timestamp;
}
```

## Security rules — principles

The full rules live in `backend/firestore.rules`. Principles you must follow (M7.0 lands the partnership additions):

1. **A user can read and write only their own `users/{uid}` and subcollections.** Period — this is the default.
2. **A user's active partner can read their `users/{uid}/social` doc** only if a corresponding `partnerships/{pairId}` doc exists with `status: 'active'` and the reader's UID is in `members`. Visibility is **opt-in at pairing** (M7.0) and revoked the moment the partnership status becomes `'ended'`.
3. **Nobody can read `users/{uid}/sessions/{...}` except the user.** Not even a partner — only the **derived summary** in `social` is partner-visible. Task titles are private (L4 invariant).
4. **`partnerships/{pairId}` writes** are gated to the two `members` UIDs (sorted-UID doc id enforces the pair shape). Creation happens on `partner_invites/{inviteId}` acceptance — preferably via a cloud function for atomicity (creates partnership + deletes the invite); client-side write is acceptable while we stay on the Firebase free tier (L13 pattern), as long as the rule requires the accepting UID to match `to_uid` (or that the invite exists and references the accepter).
5. **`partner_invites/{inviteId}` reads:** only sender (`from_uid`) and the recipient (matched by `to_identifier`). Writes: sender creates; recipient updates `status` only.
6. **`llm_cache/{hash}` is readable by any authenticated user, writeable by any authenticated user.** It's a derived cache; no PII in keys (hash includes use_case but no raw text).

## What lives in Cloud Functions vs client

| Action | Where |
|---|---|
| Sign up | Client (Firebase Auth) — client-side `ensureUserDoc()` skeleton write per L13 (no cloud function — stays on free tier) |
| Save session | Client (write own subcollection) + async client-side update of `social` doc (per L13 pattern; revisit cloud function once on Blaze) |
| Save / sync task queue | Client (write own `tasks` subcollection), async — no cloud function |
| Send partner invite | Client → `partner_invites/{inviteId}` |
| Accept partner invite | Client-side, atomically: create `partnerships/{pairId}` (status: 'active') + delete the invite (M7.0). Cloud function for the create+delete atomicity is a Blaze-only upgrade; revisit before public launch. |
| Compute weekly focus score | Client-side recompute on session end (no scheduled cloud function on free tier); reads `users/{uid}/sessions` and updates own `social.weekly_focus_score` |
| Partner view query | Client reads the user's **single** active partnership doc, then reads the partner's `social` + scheduled-sessions data — no n:n leaderboard query |

## Partner-aware queries

You have **one** active partner at a time (L18). Queries collapse to a single edge read + a single partner read — there is no leaderboard, no collection-group fan-out, and no `where('uid', 'in', [...])` batch.

Pattern:

```ts
// 1. Read the active partnership once, cache via TanStack Query.
const partnership = useActivePartnership();   // null if solo / pending

// 2. If active, read the partner's social doc + their scheduled sessions.
const partnerUid = partnership?.members.find((u) => u !== currentUid);
const partnerSocial = usePartnerSocialDoc(partnerUid);
const partnerScheduled = usePartnerScheduledSessions(partnerUid);
```

Both reads are gated by the security rules (#2) so the client cannot read a partner who hasn't accepted, and visibility ends the moment the partnership flips to `'ended'`.

## Cost / quota awareness

- Free tier (Spark) is fine for <50 users in beta. Re-evaluate before App Store launch (per `decisions.md`).
- Cache aggressively in TanStack Query. The active-partnership + partner-social reads are small but frequently re-read on Home / Partner tabs.
- Never put a Firestore listener on the session screen. Reads happen at session start and session end only.

## Things to ask before

- Adding a new top-level collection.
- Adding any field that would be visible to a partner (the partner-visible surface is intentionally small — `social` only).
- Adding any cross-user read beyond the single active partner (that's Phase B territory, gated on the L18 W8 market read — do NOT build it in the MVP).
- Lowering any security rule's restrictiveness (e.g. making something readable that wasn't).
- Adding a cloud function — it forces the Firebase **Blaze** plan (L13 currently keeps us on Spark).
- Changing privacy defaults (currently `private` on signup).
