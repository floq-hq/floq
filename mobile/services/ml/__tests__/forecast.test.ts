import { describe, expect, it } from 'vitest';

import {
  FORECAST_ALPHA,
  FORECAST_BETA,
  forecastNext7Days,
  MATURE_FORECAST_THRESHOLD,
  MIN_SESSIONS_FOR_FORECAST,
} from '../forecast';

/** Independent Holt's-linear reimplementation so the prediction assertions
 *  verify the production recurrence rather than echo it. */
function holt(xs: number[], alpha: number, beta: number): { level: number; trend: number } {
  let level = xs[0];
  let trend = xs[1] - xs[0];
  for (let i = 1; i < xs.length; i += 1) {
    const prev = level;
    level = alpha * xs[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prev) + (1 - beta) * trend;
  }
  return { level, trend };
}

// Independent reimplementation of sample std (n−1) so the band assertions
// verify the production math rather than echo it.
function sampleStd(xs: number[]): number {
  const n = xs.length;
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

const seq = (n: number, fn: (i: number) => number): number[] =>
  Array.from({ length: n }, (_, i) => fn(i));

describe('forecastNext7Days — gating (ml-regimes.md: 0–6 hidden)', () => {
  it('returns null for an empty series', () => {
    expect(forecastNext7Days([])).toBeNull();
  });

  it('returns null at 6 sessions (one below the gate)', () => {
    expect(forecastNext7Days(seq(6, () => 50))).toBeNull();
  });

  it('returns a forecast at exactly MIN_SESSIONS_FOR_FORECAST sessions', () => {
    const f = forecastNext7Days(seq(7, () => 50));
    expect(f).not.toBeNull();
  });
});

describe('forecastNext7Days — Holt level + trend', () => {
  it('a constant series predicts that constant, with zero trend + zero-width band', () => {
    const f = forecastNext7Days(seq(7, () => 42));
    expect(f).not.toBeNull();
    expect(f!.predicted).toBeCloseTo(42, 10);
    expect(f!.trend).toBeCloseTo(0, 10);
    expect(f!.lowerBand).toBeCloseTo(42, 10);
    expect(f!.upperBand).toBeCloseTo(42, 10);
  });

  it('projects an UPWARD trend forward for a rising series (slopes past the last point)', () => {
    const rising = [10, 20, 30, 40, 50, 60, 70];
    const f = forecastNext7Days(rising)!;
    expect(f.trend).toBeGreaterThan(0); // detects the upward trajectory
    // predicted is the NEXT session — a real forecast projects beyond the last
    // observation rather than reverting to the mean.
    expect(f.predicted).toBeGreaterThan(70);
  });

  it('projects a DOWNWARD trend for a falling series', () => {
    const falling = [70, 60, 50, 40, 30, 20, 10];
    const f = forecastNext7Days(falling)!;
    expect(f.trend).toBeLessThan(0);
    expect(f.predicted).toBeLessThan(10);
  });

  it('matches the Holt recurrence for a known series (alpha = 0.3, beta = 0.1)', () => {
    const xs = [12, 18, 25, 31, 44, 52, 63];
    const { level, trend } = holt(xs, FORECAST_ALPHA, FORECAST_BETA);
    const f = forecastNext7Days(xs)!;
    expect(f.trend).toBeCloseTo(trend, 10);
    expect(f.predicted).toBeCloseTo(level + trend, 10);
  });
});

describe('forecastNext7Days — confidence bands (wide 7–13, tight 14+)', () => {
  // Balanced two-value series → symmetric, easy-to-reason spread.
  const warming = seq(12, (i) => (i % 2 === 0 ? 40 : 60)); // length 12 → warming
  const mature = seq(14, (i) => (i % 2 === 0 ? 40 : 60)); // length 14 → mature

  it('warming bands are k=1.5 × sample std around the prediction', () => {
    const f = forecastNext7Days(warming)!;
    const halfWidth = (f.upperBand - f.lowerBand) / 2;
    expect(halfWidth).toBeCloseTo(1.5 * sampleStd(warming), 8);
    // band is symmetric about predicted
    expect(f.upperBand - f.predicted).toBeCloseTo(f.predicted - f.lowerBand, 8);
  });

  it('mature bands are k=1.0 × sample std (tighter)', () => {
    const f = forecastNext7Days(mature)!;
    const halfWidth = (f.upperBand - f.lowerBand) / 2;
    expect(halfWidth).toBeCloseTo(1.0 * sampleStd(mature), 8);
  });

  it('the mature band is tighter than the warming band for the same value pattern', () => {
    const wWidth = (() => {
      const f = forecastNext7Days(warming)!;
      return f.upperBand - f.lowerBand;
    })();
    const mWidth = (() => {
      const f = forecastNext7Days(mature)!;
      return f.upperBand - f.lowerBand;
    })();
    expect(mWidth).toBeLessThan(wWidth);
  });

  it('crosses from wide to tight exactly at MATURE_FORECAST_THRESHOLD', () => {
    const pattern = (n: number) => seq(n, (i) => (i % 2 === 0 ? 40 : 60));
    const justBelow = forecastNext7Days(pattern(MATURE_FORECAST_THRESHOLD - 1))!;
    const atThreshold = forecastNext7Days(pattern(MATURE_FORECAST_THRESHOLD))!;
    const kBelow =
      (justBelow.upperBand - justBelow.lowerBand) /
      2 /
      sampleStd(pattern(MATURE_FORECAST_THRESHOLD - 1));
    const kAt =
      (atThreshold.upperBand - atThreshold.lowerBand) /
      2 /
      sampleStd(pattern(MATURE_FORECAST_THRESHOLD));
    expect(kBelow).toBeCloseTo(1.5, 8);
    expect(kAt).toBeCloseTo(1.0, 8);
  });
});

describe('forecastNext7Days — negative scores (M4.1 invariant)', () => {
  it('does not clamp negative predictions or bands to zero', () => {
    const negs = seq(7, () => -30);
    const f = forecastNext7Days(negs)!;
    expect(f.predicted).toBeCloseTo(-30, 10);
    expect(f.lowerBand).toBeCloseTo(-30, 10);
  });

  it('a mixed positive/negative series can yield a negative lower band', () => {
    const mixed = [50, -40, 60, -20, 30, -10, 40];
    const f = forecastNext7Days(mixed)!;
    expect(Number.isNaN(f.predicted)).toBe(false);
    expect(f.lowerBand).toBeLessThan(f.upperBand);
  });
});

describe('forecast constants do not silently drift', () => {
  it('alpha, gate, and mature threshold are pinned to their spec values', () => {
    expect(FORECAST_ALPHA).toBe(0.3);
    expect(MIN_SESSIONS_FOR_FORECAST).toBe(7);
    expect(MATURE_FORECAST_THRESHOLD).toBe(14);
  });
});
