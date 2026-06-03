// S7.1 partner-view presentation logic — PURE, React/IO-free.
//
// Maps the M7.1 presence/summary primitives to what the Partner tab renders, so
// the decision logic is unit-tested and stays out of the component
// (mobile/CLAUDE.md: "Pure logic lives in a tested helper, not the hook or
// screen"). No task titles are ever in scope here — the social/summary
// projection omits them at source (L4).

import type { DerivedPresence } from '../presence/derivePresence';
import type { Phase } from '../timer';

export interface PresenceDisplay {
  /** Short status line, framed from the reader's side. */
  label: string;
  /** Phase whose color tints the presence chip, or null for the neutral (just-finished) tint. */
  phase: Phase | null;
  /** Whether to render the chip at all — idle is silent (the summary carries the recap). */
  visible: boolean;
}

// Reader-facing phrasing for each phase while the partner is live. Calibration
// copy, not the frozen phase boundaries (those live in services/timer/phases).
const PHASE_WORD: Record<Phase, string> = {
  struggle: 'getting started',
  release: 'settling in',
  flow: 'in flow',
  recovery: 'winding down',
};

/**
 * Collapse derived presence to a chip. `focusing` shows the live phase; a fresh
 * `just_finished` shows a neutral "just finished" marker; `idle` is silent (no
 * chip — the summary card stands on its own).
 */
export function presenceDisplay(p: DerivedPresence): PresenceDisplay {
  if (p.state === 'focusing') {
    const phase = p.phase ?? 'flow';
    return { label: `Focusing now · ${PHASE_WORD[phase]}`, phase, visible: true };
  }
  if (p.state === 'just_finished') {
    return { label: 'Just finished a session', phase: null, visible: true };
  }
  return { label: '', phase: null, visible: false };
}

/** Compact relative time for the "when" caption. Pure; ms-based. Mirrors the
 *  Stats SessionList house format ("just now" / "3m ago" / "2h ago" / "1d ago"). */
export function formatWhen(thenMs: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.round((nowMs - thenMs) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

/** A reaction can only be sent against a real finished session — it anchors to
 *  the summary's `ended_at` so a 🔥 names WHICH session it applauds
 *  (reactionUtils.isReactionCurrent). No summary / no end time ⇒ nothing to react to. */
export function canReact(summaryEndedAt: number | null | undefined): boolean {
  return typeof summaryEndedAt === 'number' && summaryEndedAt > 0;
}

/**
 * S7.2 beat-1 surface gate. The "[partner] is focusing — start one too?" prompt
 * renders ONLY when the partner is freshly live-focusing (presence already
 * freshness-clamped by derivePresence) AND I am NOT mid-session — the focused
 * middle is sacred; we never nudge a session from inside another one.
 */
export function shouldShowStartTogether(
  presence: DerivedPresence,
  hasActiveSession: boolean,
): boolean {
  return presence.state === 'focusing' && !hasActiveSession;
}

const PHASES: readonly Phase[] = ['struggle', 'release', 'flow', 'recovery'];

/** Narrow an untrusted `phase_at_end` string to a Phase, defaulting to `flow`
 *  (the summary projection types it loosely; the color lookup needs a valid key). */
export function asPhase(value: string | null | undefined): Phase {
  return PHASES.includes(value as Phase) ? (value as Phase) : 'flow';
}
