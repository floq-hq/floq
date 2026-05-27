---
name: floq-firestore
description: Use this skill whenever the user asks Claude to write, modify, or review anything that touches Firestore — collections, documents, queries, security rules, social profile sync, friend graph, session writes, or onboarding persistence. Triggers include "Firestore", "Firebase", "security rules", "social profile", "friend graph", "friendship", "session sync", "leaderboard", "feed", "cloud function", or any file under backend/ or mobile/services/firebase/. Do NOT use for SQLite or MMKV work — those are local storage, not Firestore.
---

# Floq Firestore — schema and rules skill

This skill loads the data model and access rules for Floq's backend. Floq's social model is the **1:1 focus partnership** (per `shared/spec/decisions.md` **L18** — a committed conviction bet; the prior n:n friends-only model is **superseded but retained for the revert path**). Anything that would expose data beyond your one active partner needs explicit approval. The **task-title privacy invariant (L4) is unchanged** — titles never leave the device to a partner.

## Before you write any Firestore code

1. Read this whole skill.
2. Check `shared/spec/decisions.md` for open decisions (especially O5 — friend graph schema).
3. If you're adding a new collection, write the schema here first.

## Collection layout

```
users/{uid}                       Single user document.
users/{uid}/sessions/{sessionId}  Subcollection — completed sessions only.
users/{uid}/tasks/{taskId}        Subcollection — current task queue (synced from SQLite).
users/{uid}/social                Single doc — partner-visible profile summary.

partnerships/{pairId}             Per L18: the 1:1 focus-partner edge (supersedes the n:n friend graph).
                                  pairId = sorted(uid_a, uid_b).join('_')
partner_invites/{inviteId}        Pending partner invites.

llm_cache/{hash}                  Optional — shared LLM result cache by input hash.

(friendships / friend_requests)   SUPERSEDED by L18 — retained in spec only for the revert path.
```

If O5 in `decisions.md` is still open, do not pick a schema for friendships — surface the conflict.

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
  privacy: 'friends' | 'private'; // default 'private' on signup
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

The current task queue. **Owner-only** (security rules #1/#3) — never readable by friends, never synced to `social`. Mirror of the local SQLite `tasks` table; written client-side and async on change (no cloud function). Source of truth: M2.5 (Zustand + MMKV) → M4.2 (SQLite + this Firestore mirror).

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

The only thing friends can read. Never write task titles here.

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

The full rules live in `backend/firestore.rules`. Principles you must follow:

1. **A user can read and write only their own `users/{uid}` and subcollections.** Period.
2. **Friends can read each other's `users/{uid}/social` doc** only if a corresponding `friendships/{pairId}` doc exists AND both users have `privacy: 'friends'`.
3. **Nobody can read `users/{uid}/sessions/{...}` except the user.** Even friends. Task titles are private.
4. **`friendships/{pairId}` writes require both UIDs in the path.** Cloud function only — clients can't create friendship docs directly. They create `friend_requests/{requestId}`, the function creates the friendship on acceptance.
5. **`friend_requests/{requestId}` reads:** only sender and recipient. Writes: only sender (create) and recipient (update status).
6. **`llm_cache/{hash}` is readable by any authenticated user, writeable by any authenticated user.** It's a derived cache; no PII in keys (hash includes use_case but no raw text).

## What lives in Cloud Functions vs client

| Action | Where |
|---|---|
| Sign up | Client (Firebase Auth) + cloud function trigger to create `users/{uid}` skeleton |
| Save session | Client (write own subcollection) + cloud function trigger to update `social` doc |
| Save / sync task queue | Client (write own `tasks` subcollection), async — no cloud function |
| Send friend request | Client → `friend_requests/{requestId}` |
| Accept friend request | Cloud function — creates `friendships/{pairId}`, deletes the request |
| Compute weekly focus score | Cloud function on a schedule, updates `social.weekly_focus_score` |
| Leaderboard query | Client query on `users` collection group, filtered by friendship — see below |

## Friend-aware queries

The leaderboard and feed are queried from the client but **must use the user's friend list as a hard filter**. Do not query across all users.

Pattern:

```ts
// 1. Read the user's friendships once and cache (TanStack Query).
const friendUids = useFriendUids();   // includes self

// 2. Query each friend's social doc by UID.
const socials = useFriendsSocialDocs(friendUids);

// 3. Sort client-side for the leaderboard.
```

Do not try to filter server-side with `where('uid', 'in', friendUids)` if friendUids > 10 (Firestore limit). Batch.

## Cost / quota awareness

- Free tier is fine for <50 users in beta. Re-evaluate before App Store launch (per `decisions.md`).
- Cache aggressively in TanStack Query. Friend social docs are small but frequently read.
- Never put a Firestore listener on the session screen. Reads happen at session start and session end only.

## Things to ask before

- Adding a new top-level collection.
- Adding any field that would be visible to friends.
- Lowering any security rule's restrictiveness (e.g. making something readable that wasn't).
- Adding a cloud function — it has cost and cold-start implications.
- Changing privacy defaults (currently `private` on signup).
