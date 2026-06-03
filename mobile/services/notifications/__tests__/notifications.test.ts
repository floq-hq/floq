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
    prefs: { breakReminderEnabled: true, sessionStartReminderEnabled: true },
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
// The schedulers now gate on notification prefs (S4.2). Mock the store (avoids
// pulling MMKV into the node env) and drive the prefs via the hoisted state.
vi.mock('../../../stores/useSettingsStore', () => ({
  useSettingsStore: { getState: () => ({ settings: state.prefs }) },
}));

import {
  preferredTimeToHour,
  breakReminderSeconds,
  cancelBreakReminder,
  cancelEntrySessionReminders,
  ensurePermission,
  scheduleBreakReminder,
  scheduleSessionStartReminder,
} from '../index';

beforeEach(() => {
  state.permission = { granted: false, canAskAgain: true };
  state.requestResult = { granted: true };
  state.scheduled = [];
  state.nextId = 0;
  state.prefs = { breakReminderEnabled: true, sessionStartReminderEnabled: true };
  vi.clearAllMocks(); // clears call history; keeps the closures above as impls
});

describe('notification preference gating (S4.2)', () => {
  it('does not schedule a break reminder when the pref is off (and clears any pending)', async () => {
    state.permission = { granted: true, canAskAgain: false };
    state.prefs.breakReminderEnabled = false;
    await scheduleBreakReminder(5);
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('does not schedule the daily reminder when the pref is off', async () => {
    state.permission = { granted: true, canAskAgain: false };
    state.prefs.sessionStartReminderEnabled = false;
    await scheduleSessionStartReminder('morning');
    expect(mocks.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules normally when prefs are on (default)', async () => {
    state.permission = { granted: true, canAskAgain: false };
    await scheduleBreakReminder(5);
    expect(mocks.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });
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

// PR3 / Bug #3 — `cancelBreakReminder()` is the public API the session-start
// path uses to kill a pending end-of-break nudge so it never fires
// mid-Session 2 (L17 lets the user skip recovery).
describe('cancelBreakReminder', () => {
  it('clears a pending break reminder, leaves others untouched', async () => {
    state.permission = { granted: true, canAskAgain: false };
    await scheduleBreakReminder(5);
    await scheduleSessionStartReminder('morning');
    expect(state.scheduled).toHaveLength(2);

    await cancelBreakReminder();
    expect(state.scheduled).toHaveLength(1);
    expect(state.scheduled[0].content.data).toEqual({ kind: 'session-start' });
  });

  it('is idempotent / no-op when no break reminder is scheduled', async () => {
    await cancelBreakReminder();
    expect(mocks.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  // audit #30 — a Skip/Start-next that fires before a just-scheduled break
  // reminder has registered must still cancel it. cancelBreakReminder awaits the
  // in-flight schedule, so the sweep can't slip in before the notification lands.
  it('cancels a break reminder even when it races a still-pending schedule', async () => {
    state.permission = { granted: true, canAskAgain: false };
    // Make the FIRST schedule slow: a naive cancel would sweep before it registers.
    mocks.scheduleNotificationAsync.mockImplementationOnce(async (req) => {
      await new Promise((r) => setTimeout(r, 20));
      const identifier = `id-${state.nextId++}`;
      state.scheduled.push({ identifier, content: req.content });
      return identifier;
    });

    const schedulePromise = scheduleBreakReminder(5); // NOT awaited — the race
    await cancelBreakReminder(); // fires while the schedule is still pending
    await schedulePromise;

    expect(state.scheduled).toHaveLength(0); // the reminder did not survive
  });

  it('does NOT prompt for permission (cancel path is side-effect free)', async () => {
    state.permission = { granted: false, canAskAgain: true };
    await cancelBreakReminder();
    expect(mocks.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

// M7.notif — the cancel-on-ENTRY sweep clears BOTH reminder kinds so neither the
// end-of-break nudge nor the daily session-start reminder fires mid-session.
describe('cancelEntrySessionReminders', () => {
  it('clears BOTH the break and the session-start reminders', async () => {
    state.permission = { granted: true, canAskAgain: false };
    await scheduleBreakReminder(5);
    await scheduleSessionStartReminder('morning');
    expect(state.scheduled).toHaveLength(2);

    await cancelEntrySessionReminders();
    expect(state.scheduled).toHaveLength(0); // both swept
  });

  it('leaves an unrelated kind untouched (only break + session-start are entry reminders)', async () => {
    state.permission = { granted: true, canAskAgain: false };
    await scheduleSessionStartReminder('morning');
    state.scheduled.push({ identifier: 'other', content: { data: { kind: 'other' as never } } });

    await cancelEntrySessionReminders();
    expect(state.scheduled.map((n) => n.content.data?.kind)).toEqual(['other']);
  });

  it('is idempotent / a no-op when nothing is scheduled', async () => {
    await cancelEntrySessionReminders();
    expect(mocks.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  // audit #30 — like cancelBreakReminder, it awaits an in-flight break schedule so
  // a fast session-entry can't slip the sweep in before the notification registers.
  it('cancels a break reminder that races a still-pending schedule', async () => {
    state.permission = { granted: true, canAskAgain: false };
    mocks.scheduleNotificationAsync.mockImplementationOnce(async (req) => {
      await new Promise((r) => setTimeout(r, 20));
      const identifier = `id-${state.nextId++}`;
      state.scheduled.push({ identifier, content: req.content });
      return identifier;
    });

    const schedulePromise = scheduleBreakReminder(5); // NOT awaited
    await cancelEntrySessionReminders();
    await schedulePromise;

    expect(state.scheduled).toHaveLength(0);
  });

  it('does NOT prompt for permission (cancel path is side-effect free)', async () => {
    state.permission = { granted: false, canAskAgain: true };
    await cancelEntrySessionReminders();
    expect(mocks.requestPermissionsAsync).not.toHaveBeenCalled();
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
