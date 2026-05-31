import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory MMKV fake (hoisted so the vi.mock factory can close over it).
const { mmkvStore } = vi.hoisted(() => ({ mmkvStore: new Map<string, string | number>() }));

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (k: string) => mmkvStore.get(k),
    getNumber: (k: string) => mmkvStore.get(k),
    set: (k: string, v: string | number) => {
      mmkvStore.set(k, v);
    },
    remove: (k: string) => {
      mmkvStore.delete(k);
    },
  }),
}));

// The Firestore mirror is fired by saveSettings — mock it so the persist test
// stays a pure local-storage test (and never loads firebase).
const { mirrorSettings } = vi.hoisted(() => ({ mirrorSettings: vi.fn(() => Promise.resolve()) }));
vi.mock('../firestoreMirror', () => ({ mirrorSettings }));

import {
  SETTINGS_KEY,
  SETTINGS_UPDATED_AT_KEY,
  saveSettings,
  loadSettings,
  loadSettingsUpdatedAt,
  applyRemoteSettings,
  clearSettings,
} from '../persist';
import { DEFAULT_SETTINGS } from '../types';

const full = (over: Partial<typeof DEFAULT_SETTINGS> = {}) => ({ ...DEFAULT_SETTINGS, ...over });

beforeEach(() => {
  mmkvStore.clear();
  mirrorSettings.mockClear();
});

describe('loadSettings', () => {
  it('returns the default on a fresh install', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings().backgroundPolicy).toBe('forgiving');
  });

  it('round-trips what saveSettings wrote (and stamps the LWW clock + fires the mirror)', () => {
    saveSettings(full({ backgroundPolicy: 'strict' }));
    expect(loadSettings()).toEqual(full({ backgroundPolicy: 'strict' }));
    expect(mmkvStore.has(SETTINGS_KEY)).toBe(true);
    expect(mmkvStore.has(SETTINGS_UPDATED_AT_KEY)).toBe(true);
    expect(loadSettingsUpdatedAt()).toBeGreaterThan(0);
    expect(mirrorSettings).toHaveBeenCalledTimes(1);
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

  it('coerces an unknown themeOverride back to system', () => {
    mmkvStore.set(SETTINGS_KEY, JSON.stringify({ themeOverride: 'sepia' }));
    expect(loadSettings().themeOverride).toBe('system');
  });

  it('migrates the legacy floq.theme_override key when the blob has no themeOverride', () => {
    mmkvStore.set('floq.theme_override', 'dark'); // pre-settings-blob choice
    mmkvStore.set(SETTINGS_KEY, JSON.stringify({ backgroundPolicy: 'strict' })); // no themeOverride
    expect(loadSettings().themeOverride).toBe('dark');
  });

  it('does NOT let the legacy key override an explicit blob themeOverride', () => {
    mmkvStore.set('floq.theme_override', 'dark');
    mmkvStore.set(SETTINGS_KEY, JSON.stringify({ themeOverride: 'light' }));
    expect(loadSettings().themeOverride).toBe('light');
  });
});

describe('applyRemoteSettings (pull-down, no mirror)', () => {
  it('writes the blob + the remote LWW clock WITHOUT firing the mirror', () => {
    applyRemoteSettings(full({ telemetryConsent: true }), 12345);
    expect(loadSettings().telemetryConsent).toBe(true);
    expect(loadSettingsUpdatedAt()).toBe(12345);
    expect(mirrorSettings).not.toHaveBeenCalled(); // remote data must not loop back up
  });
});

describe('clearSettings', () => {
  it('removes both the blob and the LWW clock', () => {
    saveSettings(full({ backgroundPolicy: 'strict' }));
    clearSettings();
    expect(mmkvStore.has(SETTINGS_KEY)).toBe(false);
    expect(mmkvStore.has(SETTINGS_UPDATED_AT_KEY)).toBe(false);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
