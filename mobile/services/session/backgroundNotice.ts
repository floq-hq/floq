// Background-distraction notice copy (S3.4).
//
// Pure formatting for the on-return toast shown when M3.4's background policy
// logs a distraction (see backgroundPolicy.ts — onBackgroundDistraction). Kept
// React-free so the wording and rounding are unit-testable in the node env, the
// same split M3.4 used for exceedsThreshold.

/** Human-readable background duration: "47s", "1m", "1m 5s". Rounds to the
 *  nearest second and never shows a negative or "0m". */
export function formatBackgroundDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

/** The exact on-return toast copy (S3.4 acceptance):
 *  "Backgrounded for 47s — logged a distraction." */
export function backgroundDistractionMessage(durationMs: number): string {
  return `Backgrounded for ${formatBackgroundDuration(durationMs)} — logged a distraction.`;
}
