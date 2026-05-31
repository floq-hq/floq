// Stats query hooks (M4.3) — TanStack Query wrappers around the synchronous
// SQLite reads + pure aggregations. One hook per Stats-screen number; all
// queryKeys live under `['stats', …]` so a single `invalidateQueries({
// queryKey: statsKeys.all })` after a session save refreshes every card.
//
// queryFns are SYNC (no await) — expo-sqlite's sync API doesn't return
// Promises, and TanStack Query v5 accepts sync queryFns. Returning `null`
// from a queryFn is allowed in v5 (only `undefined` is disallowed) — the UI
// reads `data === null` to render the "—" / cold-regime state.
//
// FOLLOW-UP (out of scope for this M-task — S3.3 owns app/focus.tsx): after
// `saveCompletedSession`, the Done handler should call
//   queryClient.invalidateQueries({ queryKey: statsKeys.all })
// so the Stats screen reflects the new session without a refetch delay.

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { CompletedSession } from '../session/types';
import { forecastNext7Days, type Forecast } from '../ml/forecast';
import { shapeForecast, type ForecastShape } from './forecastShape';
import {
  countSessionsAllTime,
  countSessionsToday,
  getAllSessionEndedAt,
  getBestSession,
  getFocusScoreSeries,
  getLastSessionEndedAt,
  getMaxFocusScore,
  getSessionsSince,
} from '../storage/sessions';
import {
  currentStreak,
  distractionRate,
  longestStreak,
  personalBest,
  todayFocusedMinutes,
  todayStartMs,
  weeklyFocusScore,
  weekStartMs,
  yesterdayRecap,
  yesterdayStartMs,
  type YesterdayRecap,
} from './aggregations';

export const statsKeys = {
  all: ['stats'] as const,
  weekly: ['stats', 'weekly'] as const,
  streak: ['stats', 'streak'] as const,
  longestStreak: ['stats', 'longestStreak'] as const,
  distractionRate: ['stats', 'distractionRate'] as const,
  personalBest: ['stats', 'personalBest'] as const,
  bestSession: ['stats', 'bestSession'] as const,
  forecast: ['stats', 'forecast'] as const,
  forecastShape: ['stats', 'forecastShape'] as const,
  todayFocused: ['stats', 'todayFocused'] as const,
  yesterdayRecap: ['stats', 'yesterdayRecap'] as const,
  sessionCount: ['stats', 'sessionCount'] as const,
  sessionsToday: ['stats', 'sessionsToday'] as const,
  lastSession: ['stats', 'lastSession'] as const,
};

export function useWeeklyFocusScore(): UseQueryResult<number | null> {
  return useQuery({
    queryKey: statsKeys.weekly,
    queryFn: () => {
      const now = Date.now();
      const rows = getSessionsSince(weekStartMs(now));
      return weeklyFocusScore(rows, now);
    },
  });
}

/** Today's total focus minutes (device-local) for the Home status line —
 *  "47 min focused". Always a number (0 before the first session today). Same
 *  `['stats', …]` namespace, so a post-session invalidateQueries({ queryKey:
 *  statsKeys.all }) refreshes it the moment a session is saved. */
export function useTodayFocusedMinutes(): UseQueryResult<number> {
  return useQuery({
    queryKey: statsKeys.todayFocused,
    queryFn: () => {
      const now = Date.now();
      return todayFocusedMinutes(getSessionsSince(todayStartMs(now)), now);
    },
  });
}

/** Yesterday's recap (focus minutes / sessions / distractions) for the Home
 *  returning state. Fetches from yesterday-midnight; yesterdayRecap clamps the
 *  upper edge so today's rows can't leak in. */
export function useYesterdayRecap(): UseQueryResult<YesterdayRecap> {
  return useQuery({
    queryKey: statsKeys.yesterdayRecap,
    queryFn: () => {
      const now = Date.now();
      return yesterdayRecap(getSessionsSince(yesterdayStartMs(now)), now);
    },
  });
}

/** Lifetime saved-session count, for Home's first-time-vs-returning state gate
 *  (0 → first-time, ≥1 → returning). Cheap COUNT; in the `['stats', …]`
 *  namespace so it flips to ≥1 the moment the first session is saved. */
export function useSessionCount(): UseQueryResult<number> {
  return useQuery({
    queryKey: statsKeys.sessionCount,
    queryFn: () => countSessionsAllTime(),
  });
}

/** Sessions completed today (device-local) — the Home status line's
 *  "2 sessions today". Same `['stats', …]` invalidation as the rest. */
export function useSessionsToday(): UseQueryResult<number> {
  return useQuery({
    queryKey: statsKeys.sessionsToday,
    queryFn: () => countSessionsToday(Date.now()),
  });
}

/** End time of the most recent session (epoch-ms) or null on an empty DB — the
 *  Home returning state's "last session 4:47 PM yesterday" (formatted in the
 *  UI). null reads as "no history yet". */
export function useLastSessionEndedAt(): UseQueryResult<number | null> {
  return useQuery({
    queryKey: statsKeys.lastSession,
    queryFn: () => getLastSessionEndedAt(),
  });
}

export function useCurrentStreak(): UseQueryResult<number> {
  return useQuery({
    queryKey: statsKeys.streak,
    queryFn: () => currentStreak(getAllSessionEndedAt(), Date.now()),
  });
}

export function useDistractionRate(): UseQueryResult<number | null> {
  return useQuery({
    queryKey: statsKeys.distractionRate,
    queryFn: () => {
      const now = Date.now();
      const rows = getSessionsSince(weekStartMs(now));
      return distractionRate(rows, now);
    },
  });
}

export function useLongestStreak(): UseQueryResult<number> {
  return useQuery({
    queryKey: statsKeys.longestStreak,
    queryFn: () => longestStreak(getAllSessionEndedAt()),
  });
}

export function usePersonalBest(): UseQueryResult<number | null> {
  return useQuery({
    queryKey: statsKeys.personalBest,
    queryFn: () => personalBest(getMaxFocusScore()),
  });
}

/** The all-time best session (highest focus score) — for the S5.1 Personal-best
 *  view's "best session" line. `null` until the user has any session. */
export function useBestSession(): UseQueryResult<CompletedSession | null> {
  return useQuery({
    queryKey: statsKeys.bestSession,
    queryFn: () => getBestSession(),
  });
}

/** Next-7-day forecast (M5.1). Returns `null` until the user has
 *  MIN_SESSIONS_FOR_FORECAST (7) sessions — S5.2 reads null as the cold-regime
 *  "learning your rhythm" state, and derives the wide-vs-tight confidence
 *  caption from the session count against the exported forecast thresholds. */
export function useForecast(): UseQueryResult<Forecast | null> {
  return useQuery({
    queryKey: statsKeys.forecast,
    queryFn: () => forecastNext7Days(getFocusScoreSeries()),
  });
}

/** The forecast shaped for S6.1's Victory chart (M6.1) — a solid `past` line, a
 *  connected `forecast` projection, and a `confidenceBand` to shade. Returns
 *  `null` below MIN_SESSIONS_FOR_FORECAST (7), same gate as useForecast(); the
 *  cold-regime "learning your rhythm" state reads that null. Same `['stats', …]`
 *  namespace, so a post-session invalidateQueries({ queryKey: statsKeys.all })
 *  refreshes the chart too. */
export function useForecastShape(): UseQueryResult<ForecastShape | null> {
  return useQuery({
    queryKey: statsKeys.forecastShape,
    queryFn: () => shapeForecast(getFocusScoreSeries()),
  });
}
