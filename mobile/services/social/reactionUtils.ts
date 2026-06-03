// Reaction helpers (M7.2) — PURE, React/IO-free.
//
// The partner-visible summary is a SINGLETON that gets overwritten each session,
// so a reaction carries `session_ended_at` to name WHICH finished session it
// reacted to. The owner only surfaces a reaction if it anchors to their LATEST
// session — otherwise a 🔥 from three sessions ago would render on today's.

const DEFAULT_TOLERANCE_MS = 1000;

/** Does this reaction anchor to the owner's most-recent session? */
export function isReactionCurrent(
  reactionSessionEndedAt: number,
  latestOwnSessionEndedAt: number | null,
  toleranceMs: number = DEFAULT_TOLERANCE_MS,
): boolean {
  if (!latestOwnSessionEndedAt) return false;
  return Math.abs(reactionSessionEndedAt - latestOwnSessionEndedAt) <= toleranceMs;
}
