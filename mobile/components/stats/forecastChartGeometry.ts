// Forecast chart geometry (S6.1) — pure, zero React/RN/SVG imports so the
// coordinate math unit-tests in plain Node. Turns a ForecastShape (M6.1) + the
// chart's pixel box into ready-to-render SVG primitives; ForecastChart.tsx only
// picks colors and draws. Mirrors the pure-helper pattern (forecastUiState.ts,
// displayPhase.ts, phasePreview.ts).
//
// The y-axis is focus score (un-clamped — can be negative, M4.1). When the series
// crosses zero we force 0 into the domain so the zero baseline is drawable and the
// curve reads honestly against it. x is session index; the past line ends exactly
// on the anchor (the last observed session) so the solid→dashed handoff is seamless.

import type { ForecastShape } from '../../services/stats/forecastShape';
import { smoothPath, type Point } from '../../services/chart/smoothPath';

export interface ChartBox {
  width: number;
  height: number;
  /** Inner inset (px) on every side, so strokes/dots aren't clipped at the edge. */
  padding: number;
}

export interface ForecastGeometry {
  /** `d` string for an SVG <Path> — the solid past line, smoothed (Catmull-Rom)
   *  so it reads as a curve, not a jagged polyline. */
  pastPath: string;
  /** `d` string for an SVG <Path> — the area under the past line closed to the
   *  baseline, for the accent fill that fades into the card toward the bottom. */
  pastFillPath: string;
  /** `d` string for an SVG <Path> — the dashed forecast projection (anchor→end). */
  forecastPath: string;
  /** `d` string for an SVG <Path> — the filled confidence quad (fans from the
   *  zero-width anchor to the full band at the projection end). */
  bandPath: string;
  /** Pixel center of the anchor (the "now" point where solid meets dashed). */
  anchor: { cx: number; cy: number };
  /** Each past session as a pixel dot + its raw data, for tap-to-inspect. */
  pastDots: { x: number; y: number; index: number; score: number }[];
  /** Pixel y of the score=0 baseline, or null when the domain doesn't cross 0. */
  zeroY: number | null;
  /** Pixel y of the chart's bottom baseline (where fills close). */
  baselineY: number;
  /** Pixel x of the past↔forecast boundary (same as the anchor's x). */
  dividerX: number;
}

const fmt = (n: number): number => Math.round(n * 100) / 100;

/** Drop the leading `M x y` from a path so its curve commands can be appended to
 *  an existing subpath (used to stitch the band's lower boundary onto its upper). */
const stripMove = (d: string): string => d.replace(/^M\s*-?[\d.]+\s+-?[\d.]+\s*/, '');

/** A closed, smoothed area between an `upper` and `lower` boundary (both
 *  left→right): smooth along upper, drop to the lower-right, smooth back along
 *  lower, close. Gives a curved confidence cone instead of a hard triangle. */
function smoothArea(upper: Point[], lower: Point[]): string {
  const up = smoothPath(upper);
  const lowRev = [...lower].reverse();
  const back = stripMove(smoothPath(lowRev));
  return `${up} L ${lowRev[0].x} ${lowRev[0].y} ${back} Z`;
}

/**
 * Map a ForecastShape into pixel-space SVG primitives for ChartBox. Pure number
 * work — never returns NaN for a valid (gated-in) shape; a constant series yields
 * a zero-width band that collapses onto the forecast line.
 */
export function forecastGeometry(shape: ForecastShape, box: ChartBox): ForecastGeometry {
  const { width, height, padding } = box;
  const innerW = Math.max(0, width - 2 * padding);
  const innerH = Math.max(0, height - 2 * padding);

  // --- domains ---------------------------------------------------------------
  const xs = [
    ...shape.past.map((p) => p.x),
    ...shape.forecast.map((p) => p.x),
  ];
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const xSpan = xMax - xMin || 1; // guard a degenerate single-x domain

  // Include EVERY band point (the cone is now multi-point) so nothing clips.
  const ys = [
    ...shape.past.map((p) => p.y),
    ...shape.forecast.map((p) => p.y),
    ...shape.confidenceBand.upper.map((p) => p.y),
    ...shape.confidenceBand.lower.map((p) => p.y),
  ];
  // Force 0 into the domain when any value is negative, so the baseline shows.
  if (ys.some((y) => y < 0)) ys.push(0);
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  const rawRange = yMax - yMin || 1; // constant series → avoid /0
  const pad = rawRange * 0.1; // 10% breathing room top + bottom
  yMin -= pad;
  yMax += pad;
  const ySpan = yMax - yMin;

  const sx = (x: number): number => fmt(padding + ((x - xMin) / xSpan) * innerW);
  // Invert: larger score sits higher on screen (smaller pixel y).
  const sy = (y: number): number => fmt(padding + ((yMax - y) / ySpan) * innerH);

  const pastPixels: Point[] = shape.past.map((p) => ({ x: sx(p.x), y: sy(p.y) }));
  const pastPath = smoothPath(pastPixels);

  const baselineY = fmt(padding + innerH);
  const firstX = pastPixels[0].x;
  const lastPastX = pastPixels[pastPixels.length - 1].x;
  const pastFillPath = `${pastPath} L ${lastPastX} ${baselineY} L ${firstX} ${baselineY} Z`;

  const pastDots = shape.past.map((p) => ({
    x: sx(p.x),
    y: sy(p.y),
    index: p.x,
    score: p.y,
  }));

  const anchorPt = shape.forecast[0];
  const anchor = { cx: sx(anchorPt.x), cy: sy(anchorPt.y) };

  // Smooth the multi-point projection into a CURVE (Catmull-Rom), not a straight
  // line; smooth the cone into a curved region, not a triangle.
  const forecastPx: Point[] = shape.forecast.map((p) => ({ x: sx(p.x), y: sy(p.y) }));
  const forecastPath = smoothPath(forecastPx);

  const upperPx: Point[] = shape.confidenceBand.upper.map((p) => ({ x: sx(p.x), y: sy(p.y) }));
  const lowerPx: Point[] = shape.confidenceBand.lower.map((p) => ({ x: sx(p.x), y: sy(p.y) }));
  const bandPath = smoothArea(upperPx, lowerPx);

  const crossesZero = yMin <= 0 && yMax >= 0;

  return {
    pastPath,
    pastFillPath,
    forecastPath,
    bandPath,
    anchor,
    pastDots,
    zeroY: crossesZero ? sy(0) : null,
    baselineY,
    dividerX: anchor.cx,
  };
}
