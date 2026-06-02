// S7.0 local partner state (MMKV) — the small device-local bits the pairing UI
// needs alongside the Firestore truth. React-free.
//
//  - myInviteCode: the code I minted (createInvite). Lets the Partner tab show
//    the "waiting on a friend" pending state + revoke it, without a collection
//    query (we read that one invite doc by code to confirm it's still pending).
//  - pendingAcceptCode: a code typed at an OFFLINE install→pair seam, persisted
//    so the explicit Retry survives a reload (S7.0 acceptance).
//  - wantPartner: the non-inert "I want a partner" intent toggle (solo never
//    blocked; this is just a signal the user is open to pairing).
//
// All three are cleared in auth.signOut()'s device-global reset path (a new
// account on the device must not inherit the prior user's pairing state) — see
// the partner-state cleanup wired alongside the other MMKV resets.

import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV();

const MY_INVITE_KEY = 'floq.partner.myInvite';
const PENDING_ACCEPT_KEY = 'floq.partner.pendingAccept';
const WANT_PARTNER_KEY = 'floq.partner.wantPartner';

export function setMyInviteCode(code: string): void {
  storage.set(MY_INVITE_KEY, code);
}
export function getMyInviteCode(): string | null {
  return storage.getString(MY_INVITE_KEY) ?? null;
}
export function clearMyInviteCode(): void {
  storage.remove(MY_INVITE_KEY);
}

export function setPendingAcceptCode(code: string): void {
  storage.set(PENDING_ACCEPT_KEY, code);
}
export function getPendingAcceptCode(): string | null {
  return storage.getString(PENDING_ACCEPT_KEY) ?? null;
}
export function clearPendingAcceptCode(): void {
  storage.remove(PENDING_ACCEPT_KEY);
}

export function setWantPartner(want: boolean): void {
  if (want) storage.set(WANT_PARTNER_KEY, '1');
  else storage.remove(WANT_PARTNER_KEY);
}
export function getWantPartner(): boolean {
  return storage.getString(WANT_PARTNER_KEY) === '1';
}

/** Device-global reset (call from auth.signOut alongside the other MMKV wipes). */
export function clearLocalPartnerState(): void {
  storage.remove(MY_INVITE_KEY);
  storage.remove(PENDING_ACCEPT_KEY);
  storage.remove(WANT_PARTNER_KEY);
}
