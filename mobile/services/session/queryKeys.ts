// Session-preview query keys (Home redesign). The Home screen previews two
// derived-but-hidden signals without starting a session: the recommended plan
// for the top task (useSessionRecommendation) and the now-context — rested +
// time-of-day fit (useNowContext). Both live under `['session', …]`.
//
// FOLLOW-UP (S-side, app/focus.tsx Done handler): alongside the existing
//   queryClient.invalidateQueries({ queryKey: statsKeys.all })
// also invalidate sessionKeys.all — a saved session changes both the
// recommendation (fatigue/recovery debt) and the now-context (last-session gap),
// so Home should reflect the new state on return without a stale read.

import type { Task } from '../tasks';

export const sessionKeys = {
  all: ['session'] as const,
  // Keyed by the inputs computeSessionPlan actually conditions on for a given
  // task, so editing the top task's difficulty/estimate recomputes the preview
  // (a same-id edit wouldn't invalidate a bare-id key).
  recommendation: (task: Task | null) =>
    ['session', 'recommendation', task?.id ?? null, task?.difficulty ?? null, task?.estMinutes ?? null] as const,
  nowContext: ['session', 'nowContext'] as const,
};
