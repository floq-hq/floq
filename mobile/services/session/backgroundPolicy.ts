// Background-during-session policy (M3.4) — resolves decisions.md O4.
//
// Watches AppState while a session is in flight: if the app stays backgrounded
// past the user's configured threshold, that's a distraction (sessions can't be
// paused — leaving IS a distraction; timer.md rule 3 / session-flow.md). One
// distraction per background→foreground episode, batched via the M3.2 funnel.
//
// The policy is a user setting (useSettingsStore): 'forgiving' (30s, default) or
// 'strict' (any background). Option (c) "exempt phone calls/alarms" is deferred —
// AppState can't tell us WHY the app backgrounded; that needs native CallKit,
// which conflicts with managed Expo (L1/L9). See decisions.md L15.
//
// This is the one session module that legitimately imports react-native (the
// AppState listener). The threshold logic is split out as pure functions so the
// decision is unit-testable without AppState.

import { AppState, type AppStateStatus } from 'react-native';
import { logDistraction } from './distraction';
import { useActiveSessionStore } from '../../stores/useActiveSessionStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import type { BackgroundPolicy } from '../settings/types';

export const FORGIVING_THRESHOLD_MS = 30_000; // O4 default: forgive quick switches

/** ms the app may be backgrounded before a distraction is logged.
 *  strict = 0 (any background counts); forgiving = 30s. */
export function backgroundThresholdMs(policy: BackgroundPolicy): number {
  return policy === 'strict' ? 0 : FORGIVING_THRESHOLD_MS;
}

/** Pure: did this background episode (ms) exceed the policy's threshold? */
export function exceedsThreshold(elapsedMs: number, policy: BackgroundPolicy): boolean {
  return elapsedMs > backgroundThresholdMs(policy);
}

export interface BackgroundPolicyOptions {
  /** Called when a background distraction is logged — drives S3.4's on-return toast. */
  onBackgroundDistraction?: (info: { durationMs: number; at: number }) => void;
  /** Injectable clock for tests. Defaults to Date.now. */
  now?: () => number;
}

/**
 * Start watching AppState for background distractions. Call on session-screen
 * mount; call the returned stop() on unmount. Returns a no-op-safe unsubscribe.
 *
 * Only 'background' starts the clock — 'inactive' (app-switcher peek, notification
 * shade, the brief pre-call banner) is transient and ignored, so quick switches
 * don't false-trigger. A distraction is logged only if a session is actually in
 * flight and the elapsed background time exceeds the current policy threshold.
 */
export function startBackgroundPolicy(options: BackgroundPolicyOptions = {}): () => void {
  const now = options.now ?? Date.now;
  let backgroundedAt: number | null = null;

  const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next === 'background') {
      backgroundedAt = now();
      return;
    }
    if (next === 'active') {
      if (backgroundedAt === null) return;
      const leftAt = backgroundedAt;
      backgroundedAt = null;

      if (!useActiveSessionStore.getState().active) return; // no session — ignore
      const elapsedMs = now() - leftAt;
      const policy = useSettingsStore.getState().settings.backgroundPolicy;
      if (exceedsThreshold(elapsedMs, policy)) {
        logDistraction(leftAt); // the distraction happened when they left
        options.onBackgroundDistraction?.({ durationMs: elapsedMs, at: leftAt });
      }
    }
    // 'inactive' / 'extension' / 'unknown' → transient, ignore.
  });

  return () => subscription.remove();
}
