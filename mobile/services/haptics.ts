/**
 * Haptic feedback helpers (S6.2). One guarded home for every haptic call so the
 * native-module guard isn't duplicated at each call site.
 *
 * expo-haptics' native module is only present in a rebuilt dev client / a real
 * build — it's absent in a JS-only reload before the rebuild, and silent on the
 * simulator (no Taptic Engine). Every call is wrapped so a tap still does its
 * real work (log, navigate) and simply doesn't buzz when the engine is absent.
 *
 * React-free, side-effect-only. Used by the distraction button (medium impact)
 * and the session DONE action (success notification).
 */
import * as Haptics from 'expo-haptics';

/** Medium-impact tap — GOT DISTRACTED (a deliberate, neutral log; not an error). */
export function impactMedium(): void {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  } catch {
    // Native module unavailable (pre-rebuild) — ignore.
  }
}

/** Success notification — session DONE (a completion, the one celebratory cue). */
export function notifySuccess(): void {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } catch {
    // Native module unavailable (pre-rebuild) — ignore.
  }
}
