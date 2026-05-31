import { describe, expect, it } from 'vitest';

import { sessionKeys } from '../queryKeys';
import type { Task } from '../../tasks';

const task = (over: Partial<Task> = {}): Task => ({
  id: 'a',
  title: 'Write the report',
  difficulty: 3,
  estMinutes: 30,
  order: 0,
  done: false,
  createdAt: 0,
  ...over,
});

// The recommendation query key IS the reactivity contract for the Home/Session
// hero ring: TanStack Query refetches (→ the ring recomputes) exactly when this
// key changes. These guard that it changes for every top-task change that
// affects computeSessionPlan, and ONLY those.
describe('sessionKeys.recommendation — ring-refetch contract', () => {
  it('is null-shaped when there is no top task', () => {
    expect(sessionKeys.recommendation(null)).toEqual([
      'session',
      'recommendation',
      null,
      null,
      null,
    ]);
  });

  it('changes when the top task id changes (reorder / done / delete promotes a new task)', () => {
    expect(sessionKeys.recommendation(task({ id: 'a' }))).not.toEqual(
      sessionKeys.recommendation(task({ id: 'b' })),
    );
  });

  it('changes when difficulty is edited', () => {
    expect(sessionKeys.recommendation(task({ difficulty: 3 }))).not.toEqual(
      sessionKeys.recommendation(task({ difficulty: 5 })),
    );
  });

  it('changes when the estimate is edited', () => {
    expect(sessionKeys.recommendation(task({ estMinutes: 30 }))).not.toEqual(
      sessionKeys.recommendation(task({ estMinutes: 90 })),
    );
  });

  it('is STABLE when only the title changes (title does not affect the recommendation)', () => {
    expect(sessionKeys.recommendation(task({ title: 'A' }))).toEqual(
      sessionKeys.recommendation(task({ title: 'B' })),
    );
  });
});
