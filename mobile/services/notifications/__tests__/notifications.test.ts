import { describe, it, expect, beforeEach, vi } from 'vitest';

// expo-notifications + react-native are native; mock both (node env can't load
// them). The mock keeps an in-memory schedule so cancelByKind / dedup behavior
// runs for real against scheduleNotificationAsync + getAllScheduledNotificationsAsync.
const { state, mocks } = vi.hoisted(() => {
  const state = {
    permission: { granted: false, canAskAgain: true },
    requestResult: { granted: true },
    scheduled: [] as { identifier: string; content: { data?: { kind?: string } } }[],
    nextId: 0,
  };
  const mocks = {
    setNotificationHandler: vi.fn(),
    setNotificationChannelAsync: vi.fn(async () => {}),
    getPermissionsAsync: vi.fn(async () => state.permission),
    requestPermissionsAsync: vi.fn(async () => state.requestResult),
    getAllScheduledNotificationsAsync: vi.fn(async () => state.scheduled),
    cancelScheduledNotificationAsync: vi.fn(async (id: string) => {
      state.scheduled = state.scheduled.filter((n) => n.identifier !== id);
    }),
    scheduleNotificationAsync: vi.fn(
      async (req: { content: { data?: { kind?: string } }; trigger: unknown }) => {
        const identifier = `id-${state.nextId++}`;
        state.scheduled.push({ identifier, content: req.content });
        return identifier;
      },
    ),
  };
  return { state, mocks };
});

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-notifications', () => ({
  ...mocks,
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval', DAILY: 'daily' },
  AndroidImportance: { DEFAULT: 3 },
}));

import {
  preferredTimeToHour,
  breakReminderSeconds,
  ensurePermission,
  scheduleBreakReminder,
  scheduleSessionStartReminder,
} from '../index';

beforeEach(() => {
  state.permission = { granted: false, canAskAgain: true };
  state.requestResult = { granted: true };
  state.scheduled = [];
  state.nextId = 0;
  vi.clearAllMocks(); // clears call history; keeps the closures above as impls
});

describe('pure helpers', () => {
  it('maps Q3 preferred time to a mid-bucket hour', () => {
    expect(preferredTimeToHour('morning')).toBe(9);
    expect(preferredTimeToHour('afternoon')).toBe(14);
    expect(preferredTimeToHour('evening')).toBe(19);
  });

  it('converts break minutes to seconds, flooring at 1s for an edge break', () => {
    expect(breakReminderSeconds(5)).toBe(300);
    expect(breakReminderSeconds(0)).toBe(1);
  });
});

describe('permission', () => {
  it('ensurePermission(false) reports current grant without prompting (no app-open dialog)', async () => {
    state.permission = { granted: false, canAskAgain: true };
    expect(await ensurePermission(false)).toBe(false);
    expect(mocks.requestPermissionsAsync).not.toHaveBeenCalled();

    state.permission = { granted: true, canAskAgain: false };
    expect(await ensurePermission(false)).toBe(true);
  });
});

describe('break reminder', () => {
  it('does not prompt or schedule when permission is denied and cannot ask', async () => {
    state.permission = { granted: false, canAskAgain: false };
    await scheduleBreakReminder(5);
    expect(mocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('requests permission on first use, then schedules a one-shot interval', async () => {
    await scheduleBreakReminder(5);
    expect(mocks.requestPermissionsAsync).toHaveBeenCalledOnce();
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledOnce();
    const req = mocks.scheduleNotificationAsync.mock.calls[0][0];
    expect(req.content.data).toEqual({ kind: 'break' });
    expect(req.trigger).toMatchObject({ type: 'timeInterval', seconds: 300, repeats: false });
  });

  it('replaces a prior break reminder instead of stacking', async () => {
    state.permission = { granted: true, canAskAgain: false };
    await scheduleBreakReminder(5);
    await scheduleBreakReminder(7);
    expect(mocks.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(state.scheduled).toHaveLength(1);
    expect(state.scheduled[0].content.data).toEqual({ kind: 'break' });
  });
});

describe('session-start reminder', () => {
  it('does not prompt on the app-open resync (request:false) when not granted', async () => {
    await scheduleSessionStartReminder('morning', { request: false });
    expect(mocks.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules a daily reminder at the preferred hour and dedups across relaunches', async () => {
    state.permission = { granted: true, canAskAgain: false };
    await scheduleSessionStartReminder('evening');
    await scheduleSessionStartReminder('evening'); // relaunch resync — must not stack
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(state.scheduled).toHaveLength(1);
    const req = mocks.scheduleNotificationAsync.mock.calls[0][0];
    expect(req.trigger).toMatchObject({ type: 'daily', hour: 19, minute: 0 });
    expect(req.content.data).toEqual({ kind: 'session-start' });
  });
});
