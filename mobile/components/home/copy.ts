// Home dashboard copy + formatting helpers (Home redesign, S-side).
//
// The hidden signals the M-side hooks surface (recommendation regime, now-
// context, last-session time) become human lines HERE, in the UI layer — never
// re-derived from the frozen formula. Pure and unit-tested; the screen stays a
// thin composition over these.
//
// design-system.md tone: calm, scientific, anti-gamified. No emoji as UI, no
// streak-on-fire — so these return plain words, not glyphs; the screen styles
// them with the type scale + the single teal accent.

import type { NowContext } from '../../services/session/nowContext';
import type { HourBucket, SessionPlan } from '../../services/timer';

/** Regime → the "where the model is with you" caption. The regime IS the
 *  product's intelligence (cold→warming→mature as it learns you); naming it
 *  plainly — no badge — is the point. */
export function regimeLabel(regime: SessionPlan['regime']): string {
  switch (regime) {
    case 'cold':
      return 'Learning your rhythm';
    case 'warming':
      return 'Tuning to you';
    case 'mature':
      return 'Dialed in';
  }
}

/** Time-of-day greeting. Plain, no name needed. night folds into "evening". */
export function greeting(now: number): string {
  const h = new Date(now).getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** "Prime focus time." when now is in the user's declared window, else a
 *  neutral off-window note (never a scold — the session is still good). */
export function windowClause(ctx: NowContext): string {
  return ctx.onWindow ? 'Prime focus time.' : 'Outside your usual window.';
}

/** "Rested." once recovered, else the softer "Still recovering." */
export function restedClause(ctx: NowContext): string {
  return ctx.rested ? 'Rested.' : 'Still recovering.';
}

const BUCKET_WORD: Record<HourBucket, string> = {
  morning: 'morning',
  afternoon: 'afternoon',
  evening: 'evening',
  night: 'late-night',
};

/**
 * The coach line — ONE plain sentence under the recommendation hero that
 * translates the three hidden signals (regime + time-of-day fit + recovery)
 * into guidance. This is the product's voice: never a number, never a scold.
 *
 *   "You're rested and in your strong morning window — go deep."
 *   "You're still recovering but in your strong afternoon window — keep this one short."
 */
export function coachLine(regime: SessionPlan['regime'], ctx: NowContext): string {
  const recovery = ctx.rested ? 'rested' : 'still recovering';
  const window = ctx.onWindow ? `in your strong ${BUCKET_WORD[ctx.bucket]} window` : 'off your usual hours';
  // "and" when both signals agree (both good / both meh), "but" when mixed.
  const conj = ctx.rested === ctx.onWindow ? 'and' : 'but';

  let suggestion: string;
  if (!ctx.rested) suggestion = 'keep this one short';
  else if (regime === 'mature') suggestion = 'go deep';
  else if (regime === 'warming') suggestion = 'settle into a solid block';
  else suggestion = 'a steady block to set your baseline';

  return `You're ${recovery} ${conj} ${window} — ${suggestion}.`;
}

function clockTime(d: Date): string {
  const h24 = d.getHours();
  const meridiem = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${h12}:${mm} ${meridiem}`;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "4:47 PM yesterday" — clock time + a relative day word. Same-day → "today",
 *  the calendar day before → "yesterday", anything older → the weekday name
 *  ("Mon 4:47 PM"). Device-local, matching the rest of the time math. */
export function formatLastSession(endedAt: number, now: number): string {
  const end = new Date(endedAt);
  const time = clockTime(end);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (endedAt >= startOfToday.getTime()) return `${time} today`;
  if (endedAt >= startOfYesterday.getTime()) return `${time} yesterday`;
  return `${DAY_NAMES[end.getDay()]} ${time}`;
}

/** "2 sessions" / "1 session" — small count pluralizer for the status + recap
 *  lines (keeps the screen free of inline ternaries). */
export function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
