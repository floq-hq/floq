import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory MMKV fake (hoisted so the vi.mock factory can close over it).
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

import { SETTINGS_KEY, saveSettings, loadSettings, clearSettings } from '../persist';
import { DEFAULT_SETTINGS } from '../types';

beforeEach(() => {
  mmkvStore.clear();
});

describe('loadSettings', () => {
  it('returns the default on a fresh install', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings().backgroundPolicy).toBe('forgiving');
  });

  it('round-trips what saveSettings wrote', () => {
    saveSettings({ backgroundPolicy: 'strict' });
    expect([...mmkvStore.keys()]).toEqual([SETTINGS_KEY]);
    expect(loadSettings()).toEqual({ backgroundPolicy: 'strict' });
  });

  it('falls back to default on a corrupt blob', () => {
    mmkvStore.set(SETTINGS_KEY, '{ not valid json');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('coerces an unknown backgroundPolicy back to the default', () => {
    mmkvStore.set(SETTINGS_KEY, JSON.stringify({ backgroundPolicy: 'banana' }));
    expect(loadSettings().backgroundPolicy).toBe('forgiving');
  });

  it('merges over defaults so a partial blob stays complete', () => {
    mmkvStore.set(SETTINGS_KEY, JSON.stringify({}));
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('clearSettings', () => {
  it('removes the blob', () => {
    saveSettings({ backgroundPolicy: 'strict' });
    clearSettings();
    expect(mmkvStore.has(SETTINGS_KEY)).toBe(false);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
