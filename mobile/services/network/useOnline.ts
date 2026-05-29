// Network online state (S4.3) — thin wrapper around `expo-network`'s
// useNetworkState() so screens can show an offline pill without each one doing
// its own state-shape interpretation.
//
// Conservative by design: we only report `false` (offline) when we have
// **explicit** evidence (isConnected === false OR isInternetReachable === false).
// `undefined` reads as online — a flaky/lagging detector flashing a misleading
// "Offline" pill at a user who actually has connectivity is worse than briefly
// missing a real outage (false negatives > false positives for a calm pill).
//
// The pure helper is split out so the decision is unit-testable without the
// native module (mirrors services/session/backgroundPolicy.ts).

import { useNetworkState, type NetworkState } from 'expo-network';

/** Pure decision: should the UI treat the user as online? */
export function isOnlineFromState(state: NetworkState): boolean {
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

/** Reactive online state. `false` only when expo-network has explicit evidence
 *  the device is offline; `true` otherwise (including unknown — see header). */
export function useIsOnline(): boolean {
  const state = useNetworkState();
  return isOnlineFromState(state);
}
