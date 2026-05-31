// Phase-curve geometry for the C1 share card (S6.0) — pure, zero React/RN/SVG so
// it unit-tests in plain Node. Turns a session's ACTUAL focused minutes into a
// smooth engagement curve through Struggle → Release → Flow.
//
// HONESTY: we do NOT record a continuous focus signal. This curve is the
// deterministic FOUR-PHASE MODEL (the app's central claim) scaled to the real
// focused minutes — same intellectual honesty as the launchpad Phase Journey. A
// short session collapses truthfully (16 min = a partial Struggle ramp that never
// reaches Flow). Boundaries come from phaseSegments' exported constants (one
// frozen source); occurred phases come from phaseSegments() itself.

import {
  FLOW_START_MIN,
  STRUGGLE_END_MIN,
  phaseSegments,
  type FocusPhase,
} from './phaseSegments';
import { smoothPath, type Point } from '../../services/chart/smoothPath';

export interface CurveBox {
  width: number;
  height: number;
  padding: number;
}

export interface PhaseCurveGeometry {
  /** One smoothed sub-path per OCCURRED phase, colored by the component. Adjacent
   *  segments share their boundary point so the colored strokes meet. */
  strokeSegments: { phase: FocusPhase; path: string }[];
  /** The whole curve closed down to the baseline — the area to fill. */
  fillPath: string;
  /** Horizontal gradient stops (offset 0→1 across the curve) for the under-curve
   *  phase wash: each occurred phase contributes a stop at its x-midpoint, so the
   *  fill blends struggle → release → flow left-to-right. The component supplies
   *  the phase colors + alpha. One stop (a short, single-phase session) = a solid
   *  wash of that phase. */
  fillStops: { offset: number; phase: FocusPhase }[];
  /** x px of the phase boundaries (20, 21) that fall within the session. */
  dividers: number[];
  /** Axis labels for the occurred phases, with the x to center each under. */
  labels: { phase: FocusPhase; range: string; midX: number }[];
}

const r = (n: number): number => Math.round(n * 100) / 100;
const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** Modeled engagement at minute `m`, in [0,1]. Continuous across the boundaries:
 *  Struggle ease-in 0.15→0.45, Release 0.45→0.57, Flow asymptotic 0.57→~0.95. */
function engagement(m: number): number {
  if (m < STRUGGLE_END_MIN) {
    return 0.15 + 0.3 * smoothstep(m / STRUGGLE_END_MIN);
  }
  if (m < FLOW_START_MIN) {
    return 0.45 + 0.12 * ((m - STRUGGLE_END_MIN) / (FLOW_START_MIN - STRUGGLE_END_MIN));
  }
  return 0.57 + 0.38 * (1 - Math.exp(-(m - FLOW_START_MIN) / 12));
}

const EMPTY: PhaseCurveGeometry = {
  strokeSegments: [],
  fillPath: '',
  fillStops: [],
  dividers: [],
  labels: [],
};

/** Build the curve geometry for `focusMinutes` within `box`. Empty for a
 *  zero/negative session. Never emits NaN for a positive session. */
export function phaseCurveGeometry(focusMinutes: number, box: CurveBox): PhaseCurveGeometry {
  const T = Math.max(0, focusMinutes);
  if (T === 0) return EMPTY;

  const { width, height, padding } = box;
  const innerW = Math.max(0, width - 2 * padding);
  const innerH = Math.max(0, height - 2 * padding);
  const baseline = padding + innerH;

  const sx = (m: number): number => r(padding + (m / T) * innerW);
  const sy = (e: number): number => r(padding + (1 - e) * innerH);

  // Sample densely, and pin the phase boundaries + the end so segments split clean.
  const set = new Set<number>([0, T]);
  const step = T / 48;
  for (let m = step; m < T; m += step) set.add(m);
  if (T > STRUGGLE_END_MIN) set.add(STRUGGLE_END_MIN);
  if (T > FLOW_START_MIN) set.add(FLOW_START_MIN);
  const ms = [...set].sort((a, b) => a - b);

  const pts = ms.map((m) => ({ m, x: sx(m), y: sy(engagement(m)) }));
  const xy = (p: { x: number; y: number }): Point => ({ x: p.x, y: p.y });

  const segments = phaseSegments(T); // occurred phases only

  const EPS = 1e-6;
  const phaseRange: Record<FocusPhase, [number, number]> = {
    struggle: [0, Math.min(T, STRUGGLE_END_MIN)],
    release: [STRUGGLE_END_MIN, Math.min(T, FLOW_START_MIN)],
    flow: [FLOW_START_MIN, T],
  };

  const strokeSegments = segments.map((s) => {
    const [lo, hi] = phaseRange[s.phase];
    const inPhase = pts.filter((p) => p.m >= lo - EPS && p.m <= hi + EPS).map(xy);
    return { phase: s.phase, path: smoothPath(inPhase) };
  });

  const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
  const fillStops = segments.map((s) => {
    const [lo, hi] = phaseRange[s.phase];
    return { offset: clamp01((lo + hi) / 2 / T), phase: s.phase };
  });

  const labels = segments.map((s) => {
    const [lo, hi] = phaseRange[s.phase];
    return {
      phase: s.phase,
      range: `${Math.round(lo)}–${Math.round(hi)}`,
      midX: sx((lo + hi) / 2),
    };
  });

  const dividers: number[] = [];
  if (T > STRUGGLE_END_MIN) dividers.push(sx(STRUGGLE_END_MIN));
  if (T > FLOW_START_MIN) dividers.push(sx(FLOW_START_MIN));

  const top = smoothPath(pts.map(xy));
  const fillPath = `${top} L ${pts[pts.length - 1].x} ${r(baseline)} L ${pts[0].x} ${r(baseline)} Z`;

  return { strokeSegments, fillPath, fillStops, dividers, labels };
}
