// Pure decision for the cross-device wipe listener (useDataWipeSync): given the
// remote tombstone, the last wipe this device applied, and whether this device
// initiated the wipe, decide what to do. Kept pure + React-free so the branching
// is unit-testable without Firestore or MMKV.

export type WipeAction = 'noop' | 'record' | 'wipe';

export interface WipeDecisionInput {
  /** Tombstone time from users/{uid}.data_cleared_at (epoch ms; 0 if unset). */
  remoteMs: number;
  /** The most recent wipe this device has already applied (epoch ms; 0 if none). */
  appliedMs: number;
  /** True if THIS device triggered the wipe (suppresses its own echo). */
  selfInitiated: boolean;
}

/**
 * - remote not newer than what we've applied -> 'noop' (nothing to do)
 * - newer, but WE triggered it (local wipe already done by the clear flow) ->
 *   'record': advance the marker only, skip the local wipe so a session/task
 *   created right after the clear survives.
 * - newer, from ANOTHER device -> 'wipe': enact the wipe locally here too.
 */
export function decideWipeAction({
  remoteMs,
  appliedMs,
  selfInitiated,
}: WipeDecisionInput): WipeAction {
  if (remoteMs <= appliedMs) return 'noop';
  return selfInitiated ? 'record' : 'wipe';
}
