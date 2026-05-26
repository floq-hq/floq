import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Settings } from '../../services/settings/types';

// Mock the persist module as spies (the I/O boundary) so the store is tested in
// isolation — no MMKV / react-native in the node env.
const { saveSettings, loadSettings, clearSettings } = vi.hoisted(() => ({
  saveSettings: vi.fn(),
  loadSettings: vi.fn((): Settings => ({ backgroundPolicy: 'forgiving' })),
  clearSettings: vi.fn(),
}));

vi.mock('../../services/settings/persist', () => ({
  SETTINGS_KEY: 'floq.settings',
  saveSettings,
  loadSettings,
  clearSettings,
}));

import { useSettingsStore } from '../useSettingsStore';

beforeEach(() => {
  vi.clearAllMocks();
  loadSettings.mockReturnValue({ backgroundPolicy: 'forgiving' });
  useSettingsStore.setState({ settings: { backgroundPolicy: 'forgiving' }, hydrated: false });
});

describe('setBackgroundPolicy', () => {
  it('updates the policy and persists it', () => {
    useSettingsStore.getState().setBackgroundPolicy('strict');
    expect(useSettingsStore.getState().settings.backgroundPolicy).toBe('strict');
    expect(saveSettings).toHaveBeenCalledWith({ backgroundPolicy: 'strict' });
  });
});

describe('hydrate', () => {
  it('loads persisted settings and flags hydrated', () => {
    loadSettings.mockReturnValue({ backgroundPolicy: 'strict' });
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
