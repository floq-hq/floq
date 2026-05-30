// Deployed TFLite model version (M5.3). Bumped on every new model file under
// mobile/assets/models/ (ml/CLAUDE.md export step 7). Stamped onto a
// CompletedSession ONLY when the mature regime actually produced the plan
// (finalize.ts), preserving the `regime === 'mature' ⟺ modelVersion present`
// invariant (regimeRouter.ts).
//
// v1 is SYNTHETIC-trained (decisions.md O11) — a pipeline-proof placeholder,
// not a validated "beats the formula" model. Retrain on real beta data before
// the TestFlight audience expands.
export const MODEL_VERSION = 'v1';

/** Filename of the deployed model in mobile/assets/models/. Kept next to the
 *  version so a bump updates both in one place. */
export const MODEL_FILENAME = 'floq-timer-v1.tflite';
