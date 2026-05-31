import { describe, expect, it } from 'vitest';

import {
  forecastNext7Days,
  MIN_SESSIONS_FOR_FORECAST,
  projectDampedScore,
} from '../../ml/forecast';
import {
  FORECAST_HORIZON_SESSIONS,
  shapeForecast,
  type ForecastShape,
} from '../forecastShape';

// A varied, deterministic series so the EWMA produces a non-zero band. Length is
// driven by `n` so we can probe each regime (warming 7–13, mature 14+).
function series(n: number): number[] {
  return Array.from({ length: n }, (_, i) => 60 + (i % 2 === 0 ? -10 : 10) + (i % 3) * 4);
}

// Non-null assert helper — these tests only call it once the gate is cleared.
function shaped(scores: readonly number[]): ForecastShape {
  const s = shapeForecast(scores);
  expect(s).not.toBeNull();
  return s as ForecastShape;
}

describe('shapeForecast', () => {
  it('returns null below the forecast gate (cold/empty)', () => {
    expect(shapeForecast([])).toBeNull();
    expect(shapeForecast(series(MIN_SESSIONS_FOR_FORECAST - 1))).toBeNull();
  });

  it('maps every observed score to its session index on the past line', () => {
    const scores = series(MIN_SESSIONS_FOR_FORECAST);
    const { past } = shaped(scores);
    expect(past).toHaveLength(scores.length);
    past.forEach((p, i) => {
      expect(p).toEqual({ x: i, y: scores[i] });
    });
  });

  it('anchors the projection and the band on the last past point (so the lines connect)', () => {
    const scores = series(9);
    const { past, forecast, confidenceBand } = shaped(scores);
    const anchor = past[past.length - 1];

    expect(anchor).toEqual({ x: scores.length - 1, y: scores[scores.length - 1] });
    expect(forecast[0]).toEqual(anchor);
    expect(confidenceBand.upper[0]).toEqual(anchor);
    expect(confidenceBand.lower[0]).toEqual(anchor);
  });

  it('samples a damped-trend CURVE across the horizon (not a straight 2-point line)', () => {
    const scores = series(10);
    const fc = forecastNext7Days(scores)!;
    const lastX = scores.length - 1;
    const { forecast, confidenceBand } = shaped(scores);

    // One point per horizon step + the anchor → a multi-point curve.
    expect(forecast).toHaveLength(FORECAST_HORIZON_SESSIONS + 1);
    forecast.slice(1).forEach((p, i) => {
      const h = i + 1;
      expect(p.x).toBe(lastX + h);
      expect(p.y).toBeCloseTo(projectDampedScore(fc, h), 10);
    });

    // Damping ⇒ each forward step adds LESS than the previous (the curve flattens),
    // for a non-zero trend: |Δ(h2→h3)| < |Δ(h1→h2)|.
    if (Math.abs(fc.trend) > 1e-9) {
      const incr12 = Math.abs(forecast[2].y - forecast[1].y);
      const incr23 = Math.abs(forecast[3].y - forecast[2].y);
      expect(incr23).toBeLessThan(incr12);
    }

    // Cone widens with horizon (√h): the end half-width exceeds the 1-step band.
    const endHalf =
      confidenceBand.upper.at(-1)!.y - forecast.at(-1)!.y;
    expect(endHalf).toBeGreaterThan(fc.upperBand - fc.predicted);
  });

  it('carries the warming-wide vs mature-tight band width (rides on forecast.ts)', () => {
    // Same trailing shape, different lengths → warming (k=1.5) should be wider
    // at the projection than mature (k=1.0). We compare band half-widths.
    const warming = shaped(series(12));
    const mature = shaped(series(20));

    const halfWidth = (s: ForecastShape) =>
      s.confidenceBand.upper.at(-1)!.y - s.confidenceBand.lower.at(-1)!.y;

    expect(halfWidth(warming)).toBeGreaterThan(0);
    expect(halfWidth(mature)).toBeGreaterThan(0);
    expect(halfWidth(warming)).toBeGreaterThan(halfWidth(mature));
  });

  it('collapses the band onto the forecast line for a constant series', () => {
    const flat = Array.from({ length: 8 }, () => 50);
    const { forecast, confidenceBand } = shaped(flat);
    const predicted = forecast.at(-1)!.y;

    expect(predicted).toBe(50);
    expect(confidenceBand.upper.at(-1)!.y).toBe(50);
    expect(confidenceBand.lower.at(-1)!.y).toBe(50);
  });

  it('passes negative focus scores through un-clamped (M4.1 invariant)', () => {
    const scores = [-40, -69, -12, -88, -5, -50, -33];
    const { past, forecast } = shaped(scores);
    expect(past.some((p) => p.y < 0)).toBe(true);
    expect(forecast.at(-1)!.y).toBeLessThan(0);
  });

  it('guards the horizon constant against silent drift', () => {
    expect(FORECAST_HORIZON_SESSIONS).toBe(3);
  });
});
