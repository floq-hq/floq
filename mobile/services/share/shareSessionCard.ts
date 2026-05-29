// Capture + share the session card (S6.0). Snapshots the rendered SessionCard
// view to a PNG (react-native-view-shot) and hands the file to the OS share
// sheet via React Native's built-in Share — no extra sharing dependency. iOS
// shares a local file:// url as an image; Android file sharing is post-MVP
// (matches the iOS-first target).
//
// Not a hook / not React — call it from a press handler with the captured ref.

import { Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { RefObject } from 'react';
import type { View } from 'react-native';

export type ShareResult = 'shared' | 'dismissed' | 'failed';

/** Capture the referenced view and open the share sheet. Resolves with the
 *  outcome rather than throwing, so the caller can re-enable its button without
 *  a try/catch. A user-cancel is 'dismissed', not an error. */
export async function shareSessionCard(ref: RefObject<View | null>): Promise<ShareResult> {
  if (!ref.current) return 'failed';
  try {
    const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
    const res = await Share.share({ url: uri });
    return res.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    // Capture or share failed (e.g. nothing to render) — never crash the screen.
    return 'failed';
  }
}
