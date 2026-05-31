import { describe, expect, it, vi } from 'vitest';

// computeNowContext is PURE, but it lives alongside the useNowContext hook, so
// importing it transforms the module's heavy value-imports (storage/sessions →
// expo-sqlite, the stores → MMKV/RN, compute.ts → tflite via matureInfer).
// Mock those native leaves exactly as compute.test.ts does — the pure core
// still runs the REAL hourBucket + recoveryMod; these mocks are never called by
// computeNowContext, they only keep the node env from loading native code.
vi.mock('../../storage/sessions', () => ({
  countSessionsToday: vi.fn(() => 0),
  countSessionsAllTime: vi.fn(() => 0),
  getLastSessionEndedAt: vi.fn(() => null),
  getRecentSessions: vi.fn(() => []),
}));
vi.mock('../../../stores/useOnboardingStore', () => ({
  useOnboardingStore: { getState: () => ({ answers: null }) },
}));
vi.mock('../../../stores/useTaskStore', () => ({
  useTaskStore: { getState: () => ({ tasks: [] }) },
}));
vi.mock('../../ml/matureInfer', () => ({ matureInfer: () => null }));

import { computeNowContext } from '../nowContext';
import { RECOVERY_FLOOR } from '../recovery';

// Construct local-time epochs at RUNTIME so the hour bucket is read under the
// active TZ (vitest may share a mutated process.env.TZ across files).
const morning = (): number => new Date(2026, 4, 26, 9, 0, 0).getTime();
const evening = (): number => new Date(2026, 4, 26, 19, 0, 0).getTime();

describe('computeNowContext — time window', () => {
  it('onWindow true when the bucket matches the preferred time', () => {
    const ctx = computeNowContext({
      now: morning(),
      preferredTime: 'morning',
      lastEndedAt: null,
      prevBreakMin: 0,
    });
    expect(ctx.bucket).toBe('morning');
    expect(ctx.onWindow).toBe(true);
  });

  it('onWindow false when the bucket misses the preferred time', () => {
    const ctx = computeNowContext({
      now: evening(),
      preferredTime: 'morning',
      lastEndedAt: null,
      prevBreakMin: 0,
    });
    expect(ctx.bucket).toBe('evening');
    expect(ctx.onWindow).toBe(false);
  });
});

describe('computeNowContext — rested / recovery', () => {
  it('rested with no prior session (recoveryMod 1.0)', () => {
    const ctx = computeNowContext({
      now: morning(),
      preferredTime: 'morning',
      lastEndedAt: null,
      prevBreakMin: 0,
    });
    expect(ctx.recoveryMod).toBe(1);
    expect(ctx.rested).toBe(true);
  });

  it('rested once the gap meets the recommended break', () => {
    const now = morning();
    const ctx = computeNowContext({
      now,
      preferredTime: 'morning',
      lastEndedAt: now - 11 * 60_000, // 11-min gap == 11-min break
      prevBreakMin: 11,
    });
    expect(ctx.recoveryMod).toBe(1);
    expect(ctx.rested).toBe(true);
  });

  it('not rested (recovering) when restarting immediately after a session', () => {
    const now = morning();
    const ctx = computeNowContext({
      now,
      preferredTime: 'morning',
      lastEndedAt: now, // zero gap
      prevBreakMin: 11,
    });
    expect(ctx.recoveryMod).toBe(RECOVERY_FLOOR);
    expect(ctx.rested).toBe(false);
  });
});
