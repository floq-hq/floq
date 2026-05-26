import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { BackgroundPolicy } from '../../settings/types';

// Capture the AppState 'change' handler so tests can drive state transitions,
// and mock react-native (avoids the Flow-parse failure in the node env).
const { rn } = vi.hoisted(() => ({
  rn: {
    handler: undefined as undefined | ((s: string) => void),
    remove: vi.fn(),
  },
}));
vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: vi.fn((_event: string, h: (s: string) => void) => {
      rn.handler = h;
      return { remove: rn.remove };
    }),
  },
}));

// Mock the distraction funnel + the two stores this service reads.
const { logDistractionMock } = vi.hoisted(() => ({ logDistractionMock: vi.fn() }));
vi.mock('../distraction', () => ({ logDistraction: logDistractionMock }));

const { world } = vi.hoisted(() => ({
  world: { sessionActive: true, policy: 'forgiving' as BackgroundPolicy },
}));
vi.mock('../../../stores/useActiveSessionStore', () => ({
  useActiveSessionStore: { getState: () => ({ active: world.sessionActive ? {} : null }) },
}));
vi.mock('../../../stores/useSettingsStore', () => ({
  useSettingsStore: { getState: () => ({ settings: { backgroundPolicy: world.policy } }) },
}));

import {
  startBackgroundPolicy,
  backgroundThresholdMs,
  exceedsThreshold,
} from '../backgroundPolicy';

// Controllable clock.
let clock = 0;
const now = () => clock;

beforeEach(() => {
  vi.clearAllMocks();
  rn.handler = undefined;
  clock = 0;
  world.sessionActive = true;
  world.policy = 'forgiving';
});

describe('pure threshold logic', () => {
  it('backgroundThresholdMs: forgiving 30000, strict 0', () => {
    expect(backgroundThresholdMs('forgiving')).toBe(30_000);
    expect(backgroundThresholdMs('strict')).toBe(0);
  });

  it('exceedsThreshold: forgiving forgives <=30s, strict counts any background', () => {
    expect(exceedsThreshold(30_000, 'forgiving')).toBe(false);
    expect(exceedsThreshold(30_001, 'forgiving')).toBe(true);
    expect(exceedsThreshold(1, 'strict')).toBe(true);
    expect(exceedsThreshold(0, 'strict')).toBe(false);
  });
});

describe('startBackgroundPolicy', () => {
  function background(at: number) {
    clock = at;
    rn.handler!('background');
  }
  function active(at: number) {
    clock = at;
    rn.handler!('active');
  }

  it('forgiving: logs one distraction (at the leave time) after a >30s background', () => {
    const onBg = vi.fn();
    startBackgroundPolicy({ now, onBackgroundDistraction: onBg });
    background(0);
    active(31_000);
    expect(logDistractionMock).toHaveBeenCalledTimes(1);
    expect(logDistractionMock).toHaveBeenCalledWith(0);
    expect(onBg).toHaveBeenCalledWith({ durationMs: 31_000, at: 0 });
  });

  it('forgiving: does NOT log a short (<30s) background', () => {
    startBackgroundPolicy({ now });
    background(0);
    active(10_000);
    expect(logDistractionMock).not.toHaveBeenCalled();
  });

  it('strict: logs any background, however brief', () => {
    world.policy = 'strict';
    startBackgroundPolicy({ now });
    background(0);
    active(2_000);
    expect(logDistractionMock).toHaveBeenCalledTimes(1);
  });

  it('does not log when no session is in flight', () => {
    world.sessionActive = false;
    startBackgroundPolicy({ now });
    background(0);
    active(60_000);
    expect(logDistractionMock).not.toHaveBeenCalled();
  });

  it("ignores transient 'inactive' (no background episode started)", () => {
    startBackgroundPolicy({ now });
    clock = 5_000;
    rn.handler!('inactive');
    active(60_000);
    expect(logDistractionMock).not.toHaveBeenCalled();
  });

  it('stop() removes the AppState subscription', () => {
    const stop = startBackgroundPolicy({ now });
    stop();
    expect(rn.remove).toHaveBeenCalled();
  });
});
