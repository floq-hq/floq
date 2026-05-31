import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TrainingSample } from '../../storage/trainingOutbox';

const { addDoc, collectionMock, takeSettledUnuploaded, markUploaded, state } = vi.hoisted(() => ({
  addDoc: vi.fn((..._a: unknown[]): Promise<{ id: string }> => Promise.resolve({ id: 'auto1' })),
  collectionMock: vi.fn((_db: unknown, name: string) => ({ __col: name })),
  takeSettledUnuploaded: vi.fn((): TrainingSample[] => []),
  markUploaded: vi.fn((_id: string) => {}),
  state: { consent: false, currentUser: null as null | { uid: string } },
}));

vi.mock('firebase/firestore', () => ({
  addDoc: (...a: unknown[]) => addDoc(...a),
  collection: (db: unknown, name: string) => collectionMock(db, name),
  serverTimestamp: () => ({ __serverTs: true }),
}));
vi.mock('../../firebase/init', () => ({ db: {} }));
vi.mock('../../firebase/auth', () => ({ auth: state }));
vi.mock('../../storage/trainingOutbox', () => ({
  takeSettledUnuploaded: () => takeSettledUnuploaded(),
  markUploaded: (id: string) => markUploaded(id),
}));
vi.mock('../../../stores/useSettingsStore', () => ({
  useSettingsStore: { getState: () => ({ settings: { telemetryConsent: state.consent } }) },
}));

import { toTrainingSampleDoc, flushTrainingSamples } from '../uploadTrainingSamples';

function sample(over: Partial<TrainingSample> = {}): TrainingSample {
  return {
    sessionId: 's1',
    features: Array.from({ length: 13 }, (_, i) => i / 13),
    focusScore: 37,
    actualFocusMinutes: 48,
    plannedFocusMinutes: 52,
    regime: 'warming',
    modelVersion: 'warming-v1',
    taskCompleted: true,
    createdAt: 1000,
    ...over,
  };
}

beforeEach(() => {
  addDoc.mockClear();
  addDoc.mockResolvedValue({ id: 'auto1' });
  collectionMock.mockClear();
  takeSettledUnuploaded.mockReset();
  takeSettledUnuploaded.mockReturnValue([]);
  markUploaded.mockClear();
  state.consent = false;
  state.currentUser = null;
});

describe('toTrainingSampleDoc', () => {
  it('maps to the anonymized schema doc — and carries NO sessionId / identifier', () => {
    const doc = toTrainingSampleDoc(sample(), '1.0.0');
    expect(doc).toEqual({
      features: sample().features,
      focus_score: 37,
      actual_focus_minutes: 48,
      planned_focus_minutes: 52,
      task_completed: true,
      regime: 'warming',
      model_version: 'warming-v1',
      client_version: '1.0.0',
      created_at: { __serverTs: true },
    });
    expect('sessionId' in doc).toBe(false);
    expect('uid' in doc).toBe(false);
    expect(Object.keys(doc)).toHaveLength(9);
  });
});

describe('flushTrainingSamples', () => {
  it('no-ops when consent is OFF (never touches the outbox or network)', async () => {
    state.currentUser = { uid: 'u1' };
    await flushTrainingSamples();
    expect(takeSettledUnuploaded).not.toHaveBeenCalled();
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('no-ops when signed out even with consent ON', async () => {
    state.consent = true;
    state.currentUser = null;
    await flushTrainingSamples();
    expect(takeSettledUnuploaded).not.toHaveBeenCalled();
    expect(addDoc).not.toHaveBeenCalled();
  });

  it('uploads each settled sample to training_samples and marks it uploaded (consent ON)', async () => {
    state.consent = true;
    state.currentUser = { uid: 'u1' };
    takeSettledUnuploaded.mockReturnValue([sample({ sessionId: 'a' }), sample({ sessionId: 'b' })]);

    await flushTrainingSamples();

    expect(collectionMock).toHaveBeenCalledWith({}, 'training_samples');
    expect(addDoc).toHaveBeenCalledTimes(2);
    expect(markUploaded).toHaveBeenCalledWith('a');
    expect(markUploaded).toHaveBeenCalledWith('b');
  });

  it('leaves a sample un-uploaded when its write fails (retried next flush)', async () => {
    state.consent = true;
    state.currentUser = { uid: 'u1' };
    takeSettledUnuploaded.mockReturnValue([sample({ sessionId: 'a' })]);
    addDoc.mockRejectedValueOnce(new Error('offline'));

    await flushTrainingSamples();

    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(markUploaded).not.toHaveBeenCalled(); // not marked → retried later
  });
});
