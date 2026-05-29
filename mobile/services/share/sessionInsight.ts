// One-line insight for the shareable session card (S6.0) — pure, zero React.
//
// Picks the strongest HONEST, fully-derivable statement about a single session
// from a small priority list. Never fabricates a stat: every branch is computed
// from the session's own numbers (+ the user's all-time average, when known).
// No task title ever appears (privacy, CLAUDE.md L4).

import { flowMinutes } from '../../components/session/phaseSegments';

/** The minimal session shape the card + insight need. Built from a stored
 *  CompletedSession OR from the session-end summary params — decoupled from the
 *  full record on purpose so both entry points can produce one. */
export interface SessionCardData {
  focusScore: number;
  /** Actual minutes focused. */
  focusMinutes: number;
  distractionCount: number;
  /** Epoch ms; enables the time-of-day insight. Optional (summary may omit it). */
  startedAt?: number;
}

/** Mean of a focus-score series, or null if empty. Lives here so the card's
 *  "above your average" branch and the insight share one definition. */
export function meanScore(series: readonly number[]): number | null {
  if (series.length === 0) return null;
  return series.reduce((sum, x) => sum + x, 0) / series.length;
}

function timeOfDay(hour: number): 'morning' | 'afternoon' | 'evening' {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/** Build the insight line. `avgFocusScore` is the user's all-time mean (null when
 *  this is effectively their first session). Order favors the most flattering
 *  true statement; always returns a non-empty string. */
export function sessionInsight(data: SessionCardData, avgFocusScore: number | null): string {
  const { focusScore, focusMinutes, distractionCount, startedAt } = data;

  // 1. Meaningfully above the user's own average (only when positive + ≥5%).
  if (avgFocusScore != null && avgFocusScore > 0) {
    const pct = Math.round(((focusScore - avgFocusScore) / avgFocusScore) * 100);
    if (pct >= 5) return `${pct}% above your average focus.`;
  }

  // 2. Real time in deep flow.
  const flow = Math.round(flowMinutes(focusMinutes));
  if (flow >= 10) return `${flow} minutes in deep flow.`;

  // 3. A clean, distraction-free block of real length.
  if (distractionCount === 0 && focusMinutes >= 15) {
    return 'Zero distractions — fully locked in.';
  }

  // 4. Time-of-day character (when we know when it started).
  if (typeof startedAt === 'number') {
    return `A focused ${timeOfDay(new Date(startedAt).getHours())} session.`;
  }

  // 5. Honest fallback.
  return `${Math.round(focusMinutes)} minutes of focused work.`;
}
