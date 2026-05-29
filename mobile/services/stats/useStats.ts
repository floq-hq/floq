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

import { forecastNext7Days, type Forecast } from '../ml/forecast';
import {
  getAllSessionEndedAt,
  getFocusScoreSeries,
  getMaxFocusScore,
  getSessionsSince,
} from '../storage/sessions';
import {
  currentStreak,
  distractionRate,
  personalBest,
  weeklyFocusScore,
  weekStartMs,
} from './aggregations';

export const statsKeys = {
  all: ['stats'] as const,
  weekly: ['stats', 'weekly'] as const,
  streak: ['stats', 'streak'] as const,
  distractionRate: ['stats', 'distractionRate'] as const,
  personalBest: ['stats', 'personalBest'] as const,
  forecast: ['stats', 'forecast'] as const,
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

export function usePersonalBest(): UseQueryResult<number | null> {
  return useQuery({
    queryKey: statsKeys.personalBest,
    queryFn: () => personalBest(getMaxFocusScore()),
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
