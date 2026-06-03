// Presence staleness/decay (M7.1) — PURE, React/IO-free.
//
// presence/{uid} is owner-written at session boundaries, but a crash mid-session
// or a stale `just_finished` can leave the stored state lying. The READ rule lets
// a consented partner read whatever is stored; freshness is a CLIENT decision,
// applied here so a partner never sees a permanent "focusing now" lie.

import type { Phase } from '../timer';

export type PresenceState = 'focusing' | 'idle' | 'just_finished';

export interface PresenceDoc {
  state: PresenceState;
  phase?: Phase;
  started_at?: number; // epoch ms — load-bearing for the focusing clamp
  ended_at?: number; // epoch ms — load-bearing for just_finished decay
  score?: number;
  minutes?: number;
}

export interface DerivedPresence {
  state: PresenceState;
  phase?: Phase;
  score?: number;
  minutes?: number;
}

// Calibration knobs (NOT the frozen science constants in services/timer).
const MAX_SESSION_MS = 90 * 60_000; // the phases.ts Flow ceiling
const FOCUS_MARGIN_MS = 5 * 60_000; // overrun slack past the 90-min clamp
const JUST_FINISHED_DECAY_MS = 30 * 60_000; // a finish stays "fresh" this long

/**
 * Collapse a raw presence doc to what a partner should actually see right now.
 * A `focusing` older than the max-session window, or a `just_finished` past its
 * decay window, reads as `idle`. A doc timestamped in the future (skewed partner
 * clock) also reads `idle` rather than a session that never ends.
 */
export function derivePresence(doc: PresenceDoc | null | undefined, now: number): DerivedPresence {
  if (!doc) return { state: 'idle' };

  if (
    doc.state === 'focusing' &&
    typeof doc.started_at === 'number' &&
    now >= doc.started_at &&
    now - doc.started_at <= MAX_SESSION_MS + FOCUS_MARGIN_MS
  ) {
    return { state: 'focusing', phase: doc.phase };
  }

  if (
    doc.state === 'just_finished' &&
    typeof doc.ended_at === 'number' &&
    now >= doc.ended_at &&
    now - doc.ended_at <= JUST_FINISHED_DECAY_MS
  ) {
    return { state: 'just_finished', score: doc.score, minutes: doc.minutes, phase: doc.phase };
  }

  return { state: 'idle' };
}
