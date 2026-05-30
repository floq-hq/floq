// Deployed TFLite model version (M5.3). Bumped on every new model file under
// mobile/assets/models/ (ml/CLAUDE.md export step 7). Stamped onto a
// CompletedSession ONLY when the mature regime actually produced the plan
// (finalize.ts), preserving the `regime === 'mature' ⟺ modelVersion present`
// invariant (regimeRouter.ts).
//
// v1 is SYNTHETIC-trained (decisions.md O11) — a pipeline-proof placeholder,
// not a validated "beats the formula" model. Retrain on real beta data before
// the TestFlight audience expands.
import type { SessionPlan } from '../timer';

export const MODEL_VERSION = 'v1';

/** Filename of the deployed model in mobile/assets/models/. Kept next to the
 *  version so a bump updates both in one place. */
export const MODEL_FILENAME = 'floq-timer-v1.tflite';

/** The provenance tag stamped on a training sample (L23). ALWAYS non-empty — a
 *  training sample must record which engine produced its plan, with no
 *  missing/dirty values when the data is analyzed later. The cold formula and
 *  warming blend are versioned too (they're "models" for this purpose). */
export function modelVersionFor(regime: SessionPlan['regime']): string {
  switch (regime) {
    case 'mature':
      return MODEL_VERSION; // the deployed TFLite model
    case 'warming':
      return 'warming-v1';
    case 'cold':
    default:
      return 'formula-v1';
  }
}
