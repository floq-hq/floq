---
name: floq-sync
description: Use this skill whenever the user asks Claude to write, modify, debug, or review Floq's CROSS-DEVICE sync — the real-time pull-down listeners, the local↔Firestore mirror, the task-queue last-write-wins, or the "Clear history" wipe propagation. Triggers include "sync", "cross-device", "pull-down", "listener", "onSnapshot", "last-write-wins", "LWW", "tombstone", "data_cleared_at", "wipe", "clear history", "upsert", "resurrect", "second device", or any file under mobile/services/sync/. This is the layer that JOINS local storage and Firestore — use floq-storage for local-only work and floq-firestore for schema/rules.
---

# Floq cross-device sync — the local↔Firestore join layer

Floq is **local-first**: SQLite/MMKV is the source of truth, Firestore is a **best-effort async mirror**. This skill covers `services/sync/` — the listeners that pull remote changes back down and merge them into local truth. (Schema/rules → `floq-firestore`; local persistence → `floq-storage`.)

## The invariant (do not violate)

1. **Write local first, mirror async.** Never block the UI on a network write. A failed mirror reconciles on the next sync — it must never discard local truth.
2. **Pull-down listeners only UPSERT or LAST-WRITE-WINS. They cannot represent a deletion.** An empty remote snapshot means "nothing newer," never "delete local."
3. **Deletions are an explicit tombstone event, never an inferred diff.** "Delete local rows missing from the remote snapshot" is forbidden — it nukes data created offline on a second device before it uploads (decisions L27 calls out exactly this false-delete).
4. **All sync is best-effort:** listener errors are `if (__DEV__) console.warn('[sync] …')` only — never surfaced, never thrown.
5. Every sync hook mounts **once** under the authed tab tree (`app/(tabs)/_layout`), keyed on `uid`, torn down on sign-out / uid change.

## The sync hooks (services/sync/)

| Hook | Data | Merge strategy | Why it's safe |
|---|---|---|---|
| `useSessionSync` | `users/{uid}/sessions` → SQLite | **UPSERT, insert-if-absent** | Sessions are immutable + id-keyed → conflict-free union. The Firestore doc carries LESS than the local row (no task_id/features), so a row we already have is NOT replaced (`upsertRemoteSessions` skips existing ids). `fromSessionDoc` is the exact reverse of `toSessionDoc`; keep them in lockstep. |
| `useTaskSync` | `users/{uid}/tasks` → useTaskStore | **whole-queue LWW** | Adopt remote only if `updatedAtMs > loadQueueUpdatedAt()`. Own-device echo harmlessly re-applies and advances the LWW clock to server time. |
| `useDataWipeSync` | `users/{uid}.data_cleared_at` tombstone | **explicit wipe event** | The deletion channel the other two structurally lack (L27). |

After any pull that changes session/stats data, invalidate `statsKeys.all` (`['stats']`) — the single namespace every Stats/Home card lives under.

## Loop-safety (avoid the echo storm)

A pulled queue must NOT re-trigger the up-mirror:
- `subscribeRemoteTasks` skips local-pending snapshots.
- Apply via the **no-mirror persistence path** (`applyRemote`), never the path that mirrors back up.
If you add a new synced collection, replicate both guards or you create an infinite up/down loop.

## The wipe-tombstone protocol (L27) — the deletion channel

"Clear history" deletes the cloud subcollections AND stamps `users/{uid}.data_cleared_at = serverTimestamp()`. A second signed-in device watches that field and clears locally too. The branching is the pure, tested `decideWipeAction`:

```
remoteMs <= appliedMs            → 'noop'   (already applied / nothing newer)
newer & selfInitiated            → 'record' (WE wiped already → advance marker only)
newer & !selfInitiated           → 'wipe'   (another device → enact local wipe here)
```

- **Self-echo guard:** the initiating device sets a one-shot MMKV flag (`setWipeSelfInitiated`) BEFORE stamping, so its own tombstone echo only advances the applied marker (`saveDataClearedAt`) and does NOT re-wipe — protecting a session/task created in the seconds right after the clear. Consume the flag with `clearWipeSelfInitiated`.
- **The wipe markers are device-global (not uid-scoped) → reset on sign-out** via `clearWipeMarker()` in `auth.signOut()`. A stale `selfInitiated` flag would make the next account's tombstone echo 'record' instead of 'wipe' (skipping a real wipe → resurrection); a stale applied-marker would 'noop' the next account's legitimate clear.
- **Local wipe = `wipeLocalData()`**: `deleteAllSessions` + `deleteAllTrainingSamples` + `useTaskStore.reset()` — EXACTLY what the originating Clear-history flow clears. Already-uploaded `training_samples` are anonymized/unlinkable (L23) and are NOT touched — only the local outbox.
- **Offline-safe:** `onSnapshot` delivers the current tombstone on subscribe, so a device offline during the wipe catches up on reconnect. If the cloud delete fails (offline initiator), the deletes throw first → neither flag nor tombstone is written → the "don't clear local-only" guarantee holds.
- **OTA-safe:** pure JS/TS, lives entirely in `services/` + one wiring line in `(tabs)/_layout`.

## When you add a NEW synced data type

1. Decide the merge strategy: immutable id-keyed → upsert (insert-if-absent); mutable whole-object → LWW with an `updatedAt` clock; needs deletion → add it to the tombstone wipe path.
2. Extract the decision into a **pure, tested helper** (mirror `decideWipeAction` + `wipeDecision.test.ts`).
3. Make the pull loop-safe (skip local-pending, persist via no-mirror path).
4. Invalidate the right query namespace after applying.
5. Mount the hook once in `(tabs)/_layout`, keyed on uid; dev-log errors only.
6. If it has device-global MMKV state, reset it in `auth.signOut()`.

## Ask before

- Inferring any deletion from a snapshot diff (forbidden — use a tombstone).
- Adding a Firestore listener anywhere other than `(tabs)/_layout` (never on the session screen — see `floq-firestore` cost notes).
- Changing `statsKeys` or invalidating outside `['stats']`.
- Syncing a device-local-by-design setting (e.g. `telemetryConsent` is per-device per L23 — confirm against `decisions.md` before mirroring any consent/privacy flag).
