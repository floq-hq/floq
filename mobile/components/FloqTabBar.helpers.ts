// Pure helpers for FloqTabBar (kept React/RN-free so they're unit-testable in
// the node vitest env, mirroring components/session/phaseSegments.ts).

/**
 * translateX for the active "top hairline" indicator, or `null` when the track
 * hasn't been measured yet (`cellWidth <= 0`).
 *
 * audit #24: on first paint the layout effect ran `moveTo` before `onLayout`,
 * so `cellWidth` was still 0 → target = `(0 - HAIRLINE_WIDTH) / 2` ≈ -15, and
 * the indicator animated off-screen-left then snapped back once the real width
 * arrived. Returning `null` lets the caller no-op that pre-layout move; the
 * real seat happens on the first `onLayout`.
 */
export function indicatorTranslateX(
  index: number,
  cellWidth: number,
  hairlineWidth: number,
): number | null {
  if (cellWidth <= 0) return null;
  return index * cellWidth + (cellWidth - hairlineWidth) / 2;
}
