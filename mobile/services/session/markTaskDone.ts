// L19 task-completion → ML training label bridge (L23).
//
// When the user taps "Mark task done" on the recovery screen (L19), that's the
// single best outcome signal for the timer model — "did this recommendation
// actually finish the task?" — far stronger than focus minutes alone. The
// recovery screen already calls useTaskStore.markDone(taskId) to promote the
// queue; it should ALSO call this so the just-finished session's local training
// sample records task_completed=true before the (later, consent-gated) flush.
//
// M-owned service; the one-line call from app/recovery.tsx is a Mustafa S-task
// (M/S handoff). Until it's wired, task_completed simply stays false — the label
// degrades gracefully, it never breaks.

import { setTaskCompleted } from '../storage/trainingOutbox';

/**
 * Record that the session identified by `sessionId` completed its task. Safe to
 * call with an unknown id (no-op) and safe to call when telemetry is off — this
 * only updates the on-device outbox; nothing is uploaded here.
 */
export function markTaskCompletedForSession(sessionId: string): void {
  setTaskCompleted(sessionId);
}
