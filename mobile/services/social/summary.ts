// Partner-visible session summary projection (M7.1).
//
// VERIFIED LEAK (services/session/distraction.ts:42): the raw session doc carries
// task.title. A partner must NEVER read that (L4). So a partner reads ONLY this
// derived `users/{uid}/social/summary` doc — minutes / score / when / end-phase,
// and STRUCTURALLY no task field at all. The Gate B read rule (firestore.rules)
// already restricts who can read it; this is the writer.
//
// React-free; the write is best-effort fire-and-forget from saveCompletedSession.

import { Timestamp, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/init';
import { auth } from '../firebase/auth';
import { phaseFor } from '../timer';
import type { CompletedSession } from '../session/types';

/** The exact partner-visible shape. No `task`/`title` key exists here — the
 *  omission is structural (and unit-asserted), not a filter that can regress. */
export function toSummaryDoc(s: CompletedSession) {
  return {
    minutes: s.actualFocusMinutes,
    focus_score: s.focusScore,
    ended_at: Timestamp.fromMillis(s.endedAt),
    phase_at_end: phaseFor(s.actualFocusMinutes * 60, s.plan),
  };
}

/** Project the just-saved session to the partner-readable summary. Fires for both
 *  the Done and the saved-partial paths (last-session reflects reality). */
export async function writeSocialSummary(s: CompletedSession): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) return;
  await setDoc(doc(db, 'users', me, 'social', 'summary'), toSummaryDoc(s));
}
