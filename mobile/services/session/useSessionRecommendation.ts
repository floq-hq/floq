// Session-recommendation preview (Home redesign) — run the SAME
// computeSessionPlan the START tap runs, on the top task, at Home render, so the
// hero ring can show "52 min focus · 11 min break" + the regime BEFORE the user
// commits. The recommendation is the product; today it only appears after START.
//
// This does NOT start a session and never mutates state — it's a read-through
// preview. computeSessionPlan is the frozen-formula orchestration layer; we call
// it unchanged.
//
// computeSessionPlan THROWS when onboarding answers are missing. That happens on
// a cold-boot race, or when a dev Fast Refresh resets the onboarding Zustand
// store to null (the gate that hydrates it at boot doesn't re-run). So we GATE
// the query on onboarding readiness (reactive — a Zustand subscription): the
// preview simply doesn't run until answers exist, and the moment Home re-
// hydrates them, `enabled` flips true and the query runs (the static queryKey
// wouldn't otherwise refetch on hydration). The try/catch stays as a last-resort
// net for the unknown-task-id case.

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { Task } from '../tasks';
import type { SessionPlan } from '../timer';
import { useOnboardingStore } from '../../stores/useOnboardingStore';
import { computeSessionPlan } from './compute';
import { sessionKeys } from './queryKeys';

/** Preview the session plan for the current top task. Returns null/undefined
 *  when there's no top task (Home's empty/first-time states) or onboarding
 *  answers aren't loaded yet. Keyed on the task's plan-relevant fields so an
 *  edit to the top task recomputes — see sessionKeys.recommendation. */
export function useSessionRecommendation(
  topTask: Task | null,
): UseQueryResult<SessionPlan | null> {
  const onboardingReady = useOnboardingStore((s) => s.answers !== null);

  return useQuery({
    queryKey: sessionKeys.recommendation(topTask),
    // Don't compute until we have a task AND onboarding answers — computing
    // without answers throws. Reactive: hydrating answers flips this true.
    enabled: topTask !== null && onboardingReady,
    queryFn: () => {
      if (!topTask) return null;
      try {
        return computeSessionPlan(topTask.id);
      } catch {
        return null;
      }
    },
  });
}
