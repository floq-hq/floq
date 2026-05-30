// Display-only phase clamp (audit #13).
//
// The FROZEN phase state machine `phaseFor` (services/timer/phases.ts) returns
// 'recovery' the moment `elapsed >= focusMinutes * 60`. On the /focus screen that
// moment is the *suggested stop*, but the user may still be actively focusing —
// the session isn't over until DONE. Showing a "RECOVERY" pill there contradicts
// the L16 invariant ("stays Flow past suggested time"; overrun is owned by the
// SuggestedStopMeter, not the phase pill).
//
// So for the /focus pill ONLY we clamp 'recovery' → 'flow'. This does NOT touch
// phases.ts (frozen, root CLAUDE.md safety rule) — the real recovery phase lives
// on the /recovery screen after DONE, never on /focus.
import type { Phase } from '../../services/timer';

export function displayPhase(phase: Phase): Phase {
  return phase === 'recovery' ? 'flow' : phase;
}
