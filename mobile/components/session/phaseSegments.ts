// Phase journey for the shareable session card (S6.0) — pure, zero React/RN so
// it unit-tests in plain Node. Splits a session's ACTUAL focused minutes into
// the Struggle → Release → Flow segments for the card's phase ribbon.
//
// The two boundaries mirror the FROZEN timer.md phases table (phases.ts keeps
// them module-private; we deliberately do NOT edit that frozen safety-rule file
// just to export them). A test in __tests__/phaseSegments.test.ts guards these
// against phaseFor() so they can never silently drift.
//
// Recovery is intentionally excluded: it's the post-focus break, not part of the
// focus journey the card celebrates (Struggle → Release → Flow).

export type FocusPhase = 'struggle' | 'release' | 'flow';

export interface PhaseSegment {
  phase: FocusPhase;
  minutes: number;
  /** Share of the total focused time, (0, 1]. Segments sum to 1. */
  fraction: number;
}

const STRUGGLE_END_MIN = 20; // timer.md: Struggle [0, 20:00)
const FLOW_START_MIN = 21; // timer.md: Release [20:00, 21:00), Flow from 21:00

/** Segment the actual focused minutes into Struggle/Release/Flow. Returns only
 *  the phases with > 0 time (a short session is all Struggle); empty for a
 *  zero/negative total. */
export function phaseSegments(actualFocusMinutes: number): PhaseSegment[] {
  const total = Math.max(0, actualFocusMinutes);
  if (total === 0) return [];

  const struggle = Math.min(total, STRUGGLE_END_MIN);
  const release = Math.max(0, Math.min(total, FLOW_START_MIN) - STRUGGLE_END_MIN);
  const flow = Math.max(0, total - FLOW_START_MIN);

  return (
    [
      { phase: 'struggle' as const, minutes: struggle },
      { phase: 'release' as const, minutes: release },
      { phase: 'flow' as const, minutes: flow },
    ]
      .filter((s) => s.minutes > 0)
      .map((s) => ({ ...s, fraction: s.minutes / total }))
  );
}

/** Total minutes spent in deep Flow — used by the insight generator. */
export function flowMinutes(actualFocusMinutes: number): number {
  return Math.max(0, actualFocusMinutes - FLOW_START_MIN);
}
