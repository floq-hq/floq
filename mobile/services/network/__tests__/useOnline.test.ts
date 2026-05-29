import { describe, it, expect, vi } from 'vitest';

// expo-network is a native module; mock so the pure helper imports cleanly.
vi.mock('expo-network', () => ({ useNetworkState: vi.fn() }));

import { isOnlineFromState } from '../useOnline';

describe('isOnlineFromState — conservative offline decision', () => {
  it('reports online when both fields are explicitly true', () => {
    expect(isOnlineFromState({ isConnected: true, isInternetReachable: true })).toBe(true);
  });

  it('reports offline when isConnected is explicitly false', () => {
    expect(isOnlineFromState({ isConnected: false, isInternetReachable: true })).toBe(false);
  });

  it('reports offline when isInternetReachable is explicitly false', () => {
    expect(isOnlineFromState({ isConnected: true, isInternetReachable: false })).toBe(false);
  });

  it('reports online when both fields are unknown (no false signal -> no pill)', () => {
    expect(isOnlineFromState({})).toBe(true);
  });

  it('reports online when one field is true and the other unknown', () => {
    expect(isOnlineFromState({ isConnected: true })).toBe(true);
    expect(isOnlineFromState({ isInternetReachable: true })).toBe(true);
  });
});
