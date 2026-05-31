import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Settings } from '../../services/settings/types';

const base = (over: Partial<Settings> = {}): Settings => ({
  backgroundPolicy: 'forgiving',
  themeOverride: 'system',
  telemetryConsent: false,
  breakReminderEnabled: true,
  sessionStartReminderEnabled: true,
  ...over,
});

// Mock the persist module as spies (the I/O boundary) so the store is tested in
// isolation — no MMKV / react-native / firebase in the node env.
const { saveSettings, loadSettings, applyRemoteSettings, clearSettings } = vi.hoisted(() => ({
  saveSettings: vi.fn(),
  loadSettings: vi.fn(),
  applyRemoteSettings: vi.fn(),
  clearSettings: vi.fn(),
}));

vi.mock('../../services/settings/persist', () => ({
  SETTINGS_KEY: 'floq.settings',
  saveSettings,
  loadSettings,
  applyRemoteSettings,
  clearSettings,
}));

import { useSettingsStore } from '../useSettingsStore';

beforeEach(() => {
  vi.clearAllMocks();
  loadSettings.mockReturnValue(base());
  useSettingsStore.setState({ settings: base(), hydrated: false });
});

describe('setBackgroundPolicy', () => {
  it('updates the policy and persists it', () => {
    useSettingsStore.getState().setBackgroundPolicy('strict');
    expect(useSettingsStore.getState().settings.backgroundPolicy).toBe('strict');
    expect(saveSettings).toHaveBeenCalledWith(base({ backgroundPolicy: 'strict' }));
  });
});

describe('setThemeOverride', () => {
  it('updates the theme override and persists it', () => {
    useSettingsStore.getState().setThemeOverride('dark');
    expect(useSettingsStore.getState().settings.themeOverride).toBe('dark');
    expect(saveSettings).toHaveBeenCalledWith(base({ themeOverride: 'dark' }));
  });
});

describe('applyRemote (cross-device pull)', () => {
  it('adopts the remote blob via the no-mirror persist path', () => {
    useSettingsStore.getState().applyRemote(base({ telemetryConsent: true }), 999);
    expect(applyRemoteSettings).toHaveBeenCalledWith(base({ telemetryConsent: true }), 999);
    expect(useSettingsStore.getState().settings.telemetryConsent).toBe(true);
    expect(saveSettings).not.toHaveBeenCalled(); // pull must not re-mirror
  });
});

describe('hydrate', () => {
  it('loads persisted settings and flags hydrated', () => {
    loadSettings.mockReturnValue(base({ backgroundPolicy: 'strict' }));
    useSettingsStore.getState().hydrate();
    expect(useSettingsStore.getState().settings.backgroundPolicy).toBe('strict');
    expect(useSettingsStore.getState().hydrated).toBe(true);
  });
});

describe('reset', () => {
  it('clears persistence and returns to the default', () => {
    useSettingsStore.getState().setBackgroundPolicy('strict');
    useSettingsStore.getState().reset();
    expect(clearSettings).toHaveBeenCalled();
    expect(useSettingsStore.getState().settings.backgroundPolicy).toBe('forgiving');
    expect(useSettingsStore.getState().hydrated).toBe(false);
  });
});
