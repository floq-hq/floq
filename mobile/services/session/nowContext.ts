// Now-context (Home redesign) — the "why" behind the recommendation, surfaced
// BEFORE the user starts: are they in their strong time-of-day window, and are
// they rested? These are signals the cold-start formula already consumes
// (hour_bucket vs preferred_time, and the M4.7 recovery debt) but never shows.
//
// Derived HERE, in the orchestration/UI layer — NOT returned from the frozen
// computeSessionPlan (same pattern as the L17/L20 post-modifiers and the brief's
// guidance: don't bloat the formula). The pure core takes resolved inputs so it
// is deterministic and unit-testable with no stores or I/O; the hook below wires
// the live reads.
//
// Copy lives in the UI: this returns booleans + the bucket + the raw recovery
// modifier, and the screen composes "☀ Your strong morning window. Rested."

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { HourBucket, PreferredTime } from '../timer';
import { getLastSessionEndedAt, getRecentSessions } from '../storage/sessions';
import { useOnboardingStore } from '../../stores/useOnboardingStore';
import { hourBucket } from './compute';
import { recoveryMod } from './recovery';
import { sessionKeys } from './queryKeys';

export interface NowContextInput {
  now: number;
  /** The user's onboarding Q3 answer — their declared strong window. */
  preferredTime: PreferredTime;
  /** End of the most recent session, or null if there's no history. */
  lastEndedAt: number | null;
  /** Recommended break of the most recent session; <= 0 means no prior session
   *  to recover from (recoveryMod then returns 1.0 → rested). */
  prevBreakMin: number;
}

export interface NowContext {
  /** Wall-clock bucket for `now` (same bucketing the formula uses). */
  bucket: HourBucket;
  /** Now falls inside the user's declared strong window. */
  onWindow: boolean;
  /** Fully recovered since the last session (no recovery debt). True with no
   *  prior session. The complement is "recovering" — the UI's softer label. */
  rested: boolean;
  /** Raw recovery modifier (RECOVERY_FLOOR..1.0) — exposed so the UI can show a
   *  graded "recovering" state later without re-deriving the gap math. */
  recoveryMod: number;
}

/** Pure: resolve the now-context from already-fetched inputs. */
export function computeNowContext(input: NowContextInput): NowContext {
  const bucket = hourBucket(new Date(input.now));
  const onWindow = bucket === input.preferredTime;

  const gapMin =
    input.lastEndedAt === null
      ? 0
      : Math.max(0, (input.now - input.lastEndedAt) / 60_000);
  const rmod = recoveryMod(gapMin, input.prevBreakMin);

  return { bucket, onWindow, rested: rmod >= 1.0, recoveryMod: rmod };
}

/** Live now-context for Home. Returns null until onboarding is finalized (no
 *  preferred_time to compare against — Home's first-time state doesn't show the
 *  context line anyway). Sync SQLite reads wrapped in TanStack Query under the
 *  `['session', …]` namespace; see queryKeys.ts for the post-session
 *  invalidation follow-up. */
export function useNowContext(): UseQueryResult<NowContext | null> {
  // Reactive readiness gate (same rationale as useSessionRecommendation): the
  // static queryKey wouldn't refetch when onboarding answers hydrate, so gate
  // on readiness — the query runs once answers exist and re-runs if they reset.
  const onboardingReady = useOnboardingStore((s) => s.answers !== null);

  return useQuery({
    queryKey: sessionKeys.nowContext,
    enabled: onboardingReady,
    queryFn: () => {
      const { answers } = useOnboardingStore.getState();
      if (!answers) return null;
      const now = Date.now();
      // Same gap clock as computeSessionPlan's resolveRecoveryGap: most-recent
      // ended_at + that row's recomputed break_minutes (getRecentSessions is
      // newest-first). One COUNT-free SELECT + one LIMIT-1 read.
      const lastEndedAt = getLastSessionEndedAt();
      const prevBreakMin = getRecentSessions(1)[0]?.plan.breakMinutes ?? 0;
      return computeNowContext({ now, preferredTime: answers.preferred_time, lastEndedAt, prevBreakMin });
    },
  });
}
