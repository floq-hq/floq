// S7.0 follow-up — distinguish a TRUE connectivity failure from a server
// rejection when acceptInvite throws a non-AcceptError.
//
// The accept flow used to map EVERY non-AcceptError to the synthetic 'offline'
// outcome. But a Firestore `permission-denied` (e.g. rules not deployed, or a
// rule that denies a read) is a SERVER rejection, not a network drop — showing
// "You're offline" on a live connection is misleading and hides the real
// problem. Only the genuine connectivity codes are offline; everything else maps
// to the honest 'failed' outcome.
//
// Pure + React-free + tested.

/** Firestore error codes that mean "the backend was unreachable" (truly offline). */
const OFFLINE_CODES = ['unavailable', 'deadline-exceeded'];

/** True only for a genuine connectivity failure. A `permission-denied` / internal
 *  / unknown error is NOT offline (→ the 'failed' outcome). */
export function isOfflineError(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code !== 'string') return false; // no Firestore code → not a known network drop
  return OFFLINE_CODES.some((c) => code === c || code.endsWith(`/${c}`));
}
