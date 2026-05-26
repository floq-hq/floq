// Pure phase state machine (M3.1).
//
// Maps a session's elapsed time to one of the four flow phases. Boundaries come
// straight from shared/spec/timer.md (the phases table) and are FROZEN — see the
// safety rules in the root CLAUDE.md. Do not change a boundary without citing the
// spec change.
//
// This is a *mapping only*. It does NOT enforce recovery (decisions.md O7) — the
// session screen owns that. No timers, no React, no I/O — must be unit-testable
// in plain Node.

import type { Phase, SessionPlan } from './types';

// --- Frozen boundaries (timer.md phases table) ---
// Struggle 0–20 min; Release the brief transition at ~20 min; Flow 20–90 min.
const STRUGGLE_END_SEC = 20 * 60; // timer.md:9  — Struggle [0, 20:00)
const FLOW_START_SEC = 21 * 60; // timer.md:10–11 — Release = [20:00, 21:00), Flow from 21:00

/**
 * Derive the current phase from elapsed time and the session plan. Pure and
 * deterministic: same inputs → same output, no side effects.
 *
 * The recovery check is the outermost guard on purpose. `focusMinutes` is clamped
 * to [15, 90], so a short plan's Done moment (`focusMinutes * 60`) can land before
 * the 20-min struggle boundary; testing recovery first lets such a session go
 * struggle → recovery without ever falsely reporting release/flow after Done.
 *
 * Recovery is terminal: every `elapsedSeconds >= focusMinutes * 60` returns
 * 'recovery', including values past the break window (break length drives O7
 * enforcement elsewhere, not this mapping).
 */
export function phaseFor(elapsedSeconds: number, plan: SessionPlan): Phase {
  if (elapsedSeconds >= plan.focusMinutes * 60) return 'recovery';
  if (elapsedSeconds < STRUGGLE_END_SEC) return 'struggle';
  if (elapsedSeconds < FLOW_START_SEC) return 'release';
  return 'flow';
}
