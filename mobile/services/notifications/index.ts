// Local notifications (S4.2). Two reminders, both opt-in via lazily-requested
// permission:
//   • break reminder — a one-shot fired at the end of a session's recovery
//     break ("Recovery's almost up"), scheduled when a session ends.
//   • session-start reminder — an optional daily nudge at the onboarding Q3
//     preferred time-of-day.
//
// Permission is requested only on a deliberate schedule (first session end, or
// finishing onboarding) — NEVER on app open (S4.2). The app-launch resync
// (app/index.tsx) calls scheduleSessionStartReminder with { request: false }, so
// it reschedules only when permission is already granted and never prompts.
//
// React-free. expo-notifications is the one native dependency; the pure helpers
// (preferred-time→hour, break offset) are split out and unit-tested with the
// module mocked, mirroring services/session/backgroundPolicy.ts.
//
// Reminders are deduped by a `kind` tag on content.data (cancelByKind) rather
// than a module-level id, so a relaunch can't accumulate duplicate daily
// reminders — the in-memory id would be lost across launches, the tag survives.
//
// Android channel is registered for cross-platform readiness (Android is
// post-MVP per the root spec, but must not require a rewrite).

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { PreferredTime } from '../timer';

type ReminderKind = 'break' | 'session-start';

/** Q3 preferred-time → local hour for the daily session-start reminder.
 *  Mid-bucket nudges (not bucket edges); tunable with real usage. */
export const PREFERRED_TIME_HOURS: Record<PreferredTime, number> = {
  morning: 9,
  afternoon: 14,
  evening: 19,
};

export function preferredTimeToHour(t: PreferredTime): number {
  return PREFERRED_TIME_HOURS[t];
}

export const BREAK_REMINDER = {
  title: 'Recovery’s almost up',
  body: 'Time to line up your next focus block.',
} as const;

export const SESSION_START_REMINDER = {
  title: 'Ready to focus?',
  body: 'This is around when you like to start. Want a session?',
} as const;

/** Seconds from session end to fire the break reminder — the end of the
 *  recommended break (recovery done → ready to start again). expo rejects a
 *  non-positive interval, so floor at 1s for a zero/edge break. */
export function breakReminderSeconds(breakMinutes: number): number {
  return Math.max(1, Math.round(breakMinutes * 60));
}

let configured = false;

/** Idempotent one-time setup: foreground display behavior + the Android channel.
 *  Call once at app launch (app/_layout.tsx). Does NOT request permission. */
export async function configureNotifications(): Promise<void> {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/** Whether we may post notifications. When `request` is false, reports the
 *  current grant WITHOUT prompting (used by the app-open resync so launches
 *  never trigger a permission dialog — S4.2). */
export async function ensurePermission(request = true): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!request || !current.canAskAgain) return false;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

/** Cancel every scheduled reminder of one kind (matched on content.data.kind),
 *  so scheduling is always replace-not-append and survives relaunches. */
async function cancelByKind(kind: ReminderKind): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => (n.content.data as { kind?: string } | null)?.kind === kind)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

// audit #30: the schedule (fired at DONE in focus.tsx) is not awaited by its
// caller, and a fast Skip / Start-next can call cancelBreakReminder before that
// schedule has registered its notification — the cancel sweeps nothing, the
// schedule then lands, and "Recovery's almost up" survives into Session 2. We
// track the in-flight break schedule here so cancelBreakReminder always runs its
// sweep AFTER any pending schedule has registered, regardless of caller timing.
let breakScheduleInFlight: Promise<unknown> = Promise.resolve();

/** Schedule the end-of-break nudge. Replaces any prior break reminder so breaks
 *  never stack. Prompts for permission on first use (a session just ended — a
 *  deliberate action, not app open). Silent no-op if permission is denied. */
export async function scheduleBreakReminder(breakMinutes: number): Promise<void> {
  const work = (async () => {
    if (!(await ensurePermission())) return;
    await cancelByKind('break');
    await Notifications.scheduleNotificationAsync({
      content: { title: BREAK_REMINDER.title, body: BREAK_REMINDER.body, data: { kind: 'break' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: breakReminderSeconds(breakMinutes),
        repeats: false,
      },
    });
  })();
  // Track even on failure so a later cancel never deadlocks on a rejected schedule.
  breakScheduleInFlight = work.catch(() => {});
  return work;
}

/** Cancel any pending break reminder. Called when the user starts a new session
 *  before the break is over (L17 allows skipping recovery) or when they tap
 *  Skip recovery — without this, the "Recovery's almost up" notification fires
 *  mid-session 2. Idempotent: cheap no-op when nothing is scheduled.
 *  Does NOT prompt for permission — never side-effects on a cancel path.
 *  Awaits any in-flight schedule first (audit #30) so a fast skip can't slip
 *  the sweep in before the notification is registered. */
export async function cancelBreakReminder(): Promise<void> {
  await breakScheduleInFlight;
  await cancelByKind('break');
}

/** Schedule (or reschedule) a daily reminder at the user's preferred time-of-day
 *  (onboarding Q3). Optional per S4.2; replaces the previous schedule. Pass
 *  { request: false } from the app-open resync so a launch never prompts. */
export async function scheduleSessionStartReminder(
  preferred: PreferredTime,
  { request = true }: { request?: boolean } = {},
): Promise<void> {
  if (!(await ensurePermission(request))) return;
  await cancelByKind('session-start');
  await Notifications.scheduleNotificationAsync({
    content: {
      title: SESSION_START_REMINDER.title,
      body: SESSION_START_REMINDER.body,
      data: { kind: 'session-start' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: preferredTimeToHour(preferred),
      minute: 0,
    },
  });
}
