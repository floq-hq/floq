// Smooth SVG path through points (S6.1 / S6.0) — pure, zero React/RN/SVG so it
// unit-tests in plain Node. Catmull-Rom → cubic-bézier: a curve that passes
// THROUGH every point (unlike a raw bézier), with C1 continuity, so a focus-score
// line or a phase curve reads smooth instead of a jagged polyline.
//
// Control points for the segment p1→p2 are p1 + (p2 − p0)/6 and p2 − (p3 − p1)/6
// (Catmull-Rom, tension 0.5 baked into the /6). Endpoints duplicate their
// neighbour so the first/last segments stay put. Shared by ForecastChart and the
// session-card focus curve.

export interface Point {
  x: number;
  y: number;
}

const r = (n: number): number => Math.round(n * 100) / 100;

/**
 * An SVG path `d` drawing a smooth curve through `points` (in order). Degenerates
 * safely: 0 pts → '', 1 pt → a move, 2 pts → a straight line. Never emits NaN for
 * finite inputs.
 */
export function smoothPath(points: readonly Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${r(points[0].x)} ${r(points[0].y)}`;
  if (points.length === 2) {
    return `M ${r(points[0].x)} ${r(points[0].y)} L ${r(points[1].x)} ${r(points[1].y)}`;
  }

  let d = `M ${r(points[0].x)} ${r(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? points[i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${r(cp1x)} ${r(cp1y)}, ${r(cp2x)} ${r(cp2y)}, ${r(p2.x)} ${r(p2.y)}`;
  }
  return d;
}
