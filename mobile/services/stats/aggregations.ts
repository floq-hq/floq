// Stats aggregations (M4.3 + M4.4) — pure, zero React, single-sourced math for
// the Stats screen's four numbers.
//
// CONSUMERS: the TanStack Query hooks in ./useStats.ts (do NOT call from
// screens — TanStack hooks memoize across remounts; see mobile/CLAUDE.md). All
// time math is DEVICE-LOCAL — matches the convention already used by
// services/storage/sessions.ts#countSessionsToday (O6 default for MVP;
// revisit post-MVP for travelers).
//
// L16 invariant carried by the storage layer: a row exists ONLY for sessions
// that count toward stats — completed (`completed=1` after M4.5) OR saved
// partials (`completed=0`); discarded sessions never write a row. So nothing
// in here filters by completion status, and the math stays correct once M4.5
// lands without changing this file.

import type { CompletedSession } from '../session/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Epoch-ms of device-local midnight on the day containing `ts`. */
function localMidnight(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local midnight of the day exactly one calendar day before the day containing
 *  `midnightMs`. `Date.setDate(d - 1)` is calendar-aware (handles month/year
 *  rollover) and DST-safe — a naive `midnightMs - DAY_MS` would land 1h off on
 *  a DST transition day. */
function prevDayMidnight(midnightMs: number): number {
  const d = new Date(midnightMs);
  d.setDate(d.getDate() - 1);
  return d.getTime();
}

/** Local midnight of the day exactly one calendar day after `midnightMs`.
 *  Calendar-aware / DST-safe counterpart to `prevDayMidnight` — used to walk a
 *  streak run forward in `longestStreak`. */
function nextDayMidnight(midnightMs: number): number {
  const d = new Date(midnightMs);
  d.setDate(d.getDate() + 1);
  return d.getTime();
}

/** Start of the rolling 7-day window: device-local midnight 6 days ago. Today
 *  + the previous 6 days = 7 distinct calendar days, inclusive. Exported so
 *  the query hook can hand the same start time to SQL. */
export function weekStartMs(now: number = Date.now()): number {
  return localMidnight(now) - 6 * DAY_MS;
}

/** Mean focus score across sessions ended within the rolling 7-day window.
 *  Returns null when the window is empty (UI shows "—" / cold-regime badge per
 *  S5.2). Defensive filtering: callers normally pre-filter via getSessionsSince
 *  but the function stays correct even if handed unfiltered rows. */
export function weeklyFocusScore(
  rows: readonly CompletedSession[],
  now: number = Date.now(),
): number | null {
  const start = weekStartMs(now);
  let sum = 0;
  let count = 0;
  for (const r of rows) {
    if (r.endedAt < start) continue;
    sum += r.focusScore;
    count += 1;
  }
  return count === 0 ? null : sum / count;
}

/** Consecutive device-local calendar days with ≥1 session, counting back from
 *  today. If today has no session yet, the streak is anchored at yesterday —
 *  so a 3-day streak (Mon/Tue/Wed) is not nuked the instant Thursday begins;
 *  it only breaks if Thursday ends without a session (becomes "yesterday with
 *  no session" on Friday).
 *
 *  Returns 0 if the input is empty or the most recent session is older than
 *  yesterday-midnight. (M4.4 lives here per plan: it's a one-function task and
 *  shares the day-bucket helpers.) */
export function currentStreak(
  endedAtTimestamps: readonly number[],
  now: number = Date.now(),
): number {
  if (endedAtTimestamps.length === 0) return 0;

  const dayBuckets = new Set<number>();
  for (const ts of endedAtTimestamps) {
    dayBuckets.add(localMidnight(ts));
  }

  const today = localMidnight(now);
  // Anchor at today if today has a session, else yesterday — that's the
  // grace-until-midnight behavior described above.
  let cursor = dayBuckets.has(today) ? today : prevDayMidnight(today);

  let streak = 0;
  while (dayBuckets.has(cursor)) {
    streak += 1;
    cursor = prevDayMidnight(cursor);
  }
  return streak;
}

/** Longest run of consecutive device-local calendar days with ≥1 session, all
 *  time. Unlike `currentStreak` there's no today/yesterday anchoring — this is
 *  the historical best (S5.1 "Personal best" view), so it just scans the full
 *  set of day-buckets for the longest consecutive run. Returns 0 on empty input.
 *  Same day-bucket helpers as `currentStreak` so the two stay calendar/DST-
 *  consistent. */
export function longestStreak(
  endedAtTimestamps: readonly number[],
): number {
  if (endedAtTimestamps.length === 0) return 0;

  const dayBuckets = new Set<number>();
  for (const ts of endedAtTimestamps) {
    dayBuckets.add(localMidnight(ts));
  }

  let longest = 0;
  for (const day of dayBuckets) {
    // Only start counting from the head of a run: a day whose predecessor is
    // absent. Every run is then walked exactly once.
    if (dayBuckets.has(prevDayMidnight(day))) continue;
    let run = 0;
    let cursor: number = day;
    while (dayBuckets.has(cursor)) {
      run += 1;
      cursor = nextDayMidnight(cursor);
    }
    if (run > longest) longest = run;
  }
  return longest;
}

/** Distractions per focused hour across the rolling 7-day window. Stable as
 *  session length varies (a 10-min session with 1 distraction isn't equivalent
 *  to a 60-min session with 1 distraction). Returns null when the window has
 *  no focus minutes — `0 / 0` is undefined and the UI should show "—". */
export function distractionRate(
  rows: readonly CompletedSession[],
  now: number = Date.now(),
): number | null {
  const start = weekStartMs(now);
  let distractions = 0;
  let focusMinutes = 0;
  for (const r of rows) {
    if (r.endedAt < start) continue;
    distractions += r.distractions.length;
    focusMinutes += r.actualFocusMinutes;
  }
  if (focusMinutes === 0) return null;
  return distractions / (focusMinutes / 60);
}

/** Personal best = highest single-session focus_score, all time. The SQL
 *  MAX(focus_score) already does the work (see storage/sessions#getMaxFocusScore);
 *  this stays a function so the hook signature is symmetric with the others and
 *  there's a home for future refinement (e.g., richer "best" objects in S5.1). */
export function personalBest(maxScore: number | null): number | null {
  return maxScore;
}
