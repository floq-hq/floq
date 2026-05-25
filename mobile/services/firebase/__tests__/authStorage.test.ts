import { describe, it, expect, beforeEach, vi } from 'vitest';

// Back the adapter with an in-memory Map so we can assert it maps to MMKV.
const { mmkvStore } = vi.hoisted(() => ({ mmkvStore: new Map<string, string>() }));

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (k: string) => mmkvStore.get(k),
    set: (k: string, v: string) => {
      mmkvStore.set(k, v);
    },
    remove: (k: string) => {
      mmkvStore.delete(k);
    },
  }),
}));

import { mmkvAuthStorage } from '../authStorage';

beforeEach(() => mmkvStore.clear());

describe('mmkvAuthStorage (Firebase RN persistence shim)', () => {
  it('setItem writes to MMKV and resolves', async () => {
    await expect(mmkvAuthStorage.setItem('k', 'v')).resolves.toBeUndefined();
    expect(mmkvStore.get('k')).toBe('v');
  });

  it('getItem returns the stored value', async () => {
    mmkvStore.set('k', 'v');
    await expect(mmkvAuthStorage.getItem('k')).resolves.toBe('v');
  });

  it('getItem returns null for a missing key (not undefined)', async () => {
    await expect(mmkvAuthStorage.getItem('missing')).resolves.toBeNull();
  });

  it('removeItem deletes the key and resolves', async () => {
    mmkvStore.set('k', 'v');
    await expect(mmkvAuthStorage.removeItem('k')).resolves.toBeUndefined();
    expect(mmkvStore.has('k')).toBe(false);
  });
});
