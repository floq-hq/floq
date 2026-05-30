import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CompletedSession } from '../../session/types';

vi.mock('expo-sqlite', () => import('../../../test/expoSqliteFake'));

import { resetExpoSqliteFake } from '../../../test/expoSqliteFake';
import {
  enqueueTrainingSample,
  setTaskCompleted,
  takeSettledUnuploaded,
  markUploaded,
  deleteAllTrainingSamples,
} from '../trainingOutbox';

const FEATURES = Array.from({ length: 13 }, (_, i) => i / 13);

function makeSession(over: Partial<CompletedSession> = {}): CompletedSession {
  return {
    id: 's1',
    taskId: 't1',
    task: { title: 'private title', difficulty: 4, estMinutes: 45 },
    plan: { focusMinutes: 50, breakMinutes: 11, regime: 'warming', features: FEATURES },
    startedAt: 1000,
    endedAt: 2000,
    actualFocusMinutes: 48,
    focusScore: 37,
    distractions: [],
    completed: true,
    overrunMinutes: 0,
    clientVersion: '1.0.0',
    ...over,
  };
}

beforeEach(() => {
  resetExpoSqliteFake();
});

describe('enqueueTrainingSample', () => {
  it('stages an anonymized row with the captured features + outcomes', () => {
    enqueueTrainingSample(makeSession({ endedAt: 5000 }));
    // settled via grace (single old row): readable.
    const [s] = takeSettledUnuploaded(5000 + 60 * 60 * 1000 + 1);
    expect(s.sessionId).toBe('s1');
    expect(s.features).toEqual(FEATURES);
    expect(s.focusScore).toBe(37);
    expect(s.actualFocusMinutes).toBe(48);
    expect(s.plannedFocusMinutes).toBe(50);
    expect(s.regime).toBe('warming');
    expect(s.modelVersion).toBe('warming-v1'); // derived, always set
    expect(s.taskCompleted).toBe(false);
  });

  it('is a no-op when the plan carries no feature vector', () => {
    enqueueTrainingSample(
      makeSession({ plan: { focusMinutes: 50, breakMinutes: 11, regime: 'cold' } }),
    );
    expect(takeSettledUnuploaded(Number.MAX_SAFE_INTEGER)).toEqual([]);
  });

  it('stamps model_version from the regime (cold → formula-v1)', () => {
    enqueueTrainingSample(
      makeSession({
        endedAt: 5000,
        plan: { focusMinutes: 51, breakMinutes: 11, regime: 'cold', features: FEATURES },
      }),
    );
    expect(takeSettledUnuploaded(5000 + 60 * 60 * 1000 + 1)[0].modelVersion).toBe('formula-v1');
  });

  it('re-enqueueing the same id preserves a task_completed already set', () => {
    enqueueTrainingSample(makeSession({ endedAt: 5000 }));
    setTaskCompleted('s1');
    enqueueTrainingSample(makeSession({ endedAt: 5000, focusScore: 99 })); // re-save
    const [s] = takeSettledUnuploaded(5000 + 60 * 60 * 1000 + 1);
    expect(s.taskCompleted).toBe(true); // not reset by the re-enqueue
    expect(s.focusScore).toBe(99); // other fields do update
  });
});

describe('setTaskCompleted', () => {
  it('flips task_completed and is a safe no-op for an unknown id', () => {
    enqueueTrainingSample(makeSession({ endedAt: 5000 }));
    setTaskCompleted('nope'); // no throw
    setTaskCompleted('s1');
    expect(takeSettledUnuploaded(5000 + 60 * 60 * 1000 + 1)[0].taskCompleted).toBe(true);
  });
});

describe('takeSettledUnuploaded', () => {
  it('treats a row as settled once a strictly-newer session exists', () => {
    enqueueTrainingSample(makeSession({ id: 'old', endedAt: 1000 }));
    enqueueTrainingSample(makeSession({ id: 'new', endedAt: 2000 }));
    // now well within the grace window, so only the newer-exists rule applies.
    const settled = takeSettledUnuploaded(2000).map((s) => s.sessionId);
    expect(settled).toEqual(['old']); // 'new' is the latest → held back
  });

  it('settles the latest row once it ages past the grace window', () => {
    enqueueTrainingSample(makeSession({ id: 'solo', endedAt: 1000 }));
    expect(takeSettledUnuploaded(1000).map((s) => s.sessionId)).toEqual([]); // newest + fresh
    expect(
      takeSettledUnuploaded(1000 + 60 * 60 * 1000 + 1).map((s) => s.sessionId),
    ).toEqual(['solo']); // aged past grace
  });

  it('excludes already-uploaded rows', () => {
    enqueueTrainingSample(makeSession({ id: 'old', endedAt: 1000 }));
    enqueueTrainingSample(makeSession({ id: 'new', endedAt: 2000 }));
    markUploaded('old');
    expect(takeSettledUnuploaded(2000)).toEqual([]); // 'old' uploaded, 'new' not settled
  });
});

describe('deleteAllTrainingSamples', () => {
  it('empties the outbox (sign-out teardown)', () => {
    enqueueTrainingSample(makeSession({ id: 'a', endedAt: 1000 }));
    enqueueTrainingSample(makeSession({ id: 'b', endedAt: 2000 }));
    deleteAllTrainingSamples();
    expect(takeSettledUnuploaded(Number.MAX_SAFE_INTEGER)).toEqual([]);
  });
});
