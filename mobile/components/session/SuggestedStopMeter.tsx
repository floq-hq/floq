/**
 * Suggested-stop meter (M4.9 / L16) — small live readout under the timer.
 *
 * Pre-overrun:  "Suggested stop · N min left"
 * At/past:      "Overrun · +M min"
 *
 * **NOT** a phase pill flip — the frozen `phases.ts` keeps reading "Flow" past
 * the suggested time. Overrun is a UI-derived state on `/focus`, not a 5th
 * phase (decisions.md L16).
 *
 * The minute-precision tick comes off the UI thread via Reanimated — same
 * cost / smoothness budget as the second-precision clock in SessionTimer.
 * React state updates only when the minute integer changes (and the overrun
 * boundary flips once), so there are no per-second re-renders.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  runOnJS,
  useAnimatedReaction,
  type SharedValue,
} from 'react-native-reanimated';
import { Text } from '../ui';
import { useTheme } from '../../theme';

interface Props {
  /** Same shared value the SessionTimer reads — seconds since startedAt. */
  elapsedSeconds: SharedValue<number>;
  /** plan.focusMinutes (the start-time suggestion). */
  plannedFocusMinutes: number;
}

export function SuggestedStopMeter({ elapsedSeconds, plannedFocusMinutes }: Props) {
  const theme = useTheme();
  const [elapsedMin, setElapsedMin] = useState(0);

  useAnimatedReaction(
    () => Math.floor(elapsedSeconds.value / 60),
    (cur, prev) => {
      if (cur !== prev) runOnJS(setElapsedMin)(cur);
    },
  );

  const overrun = elapsedMin >= plannedFocusMinutes;
  const left = plannedFocusMinutes - elapsedMin;
  const overrunMin = elapsedMin - plannedFocusMinutes;
  // #27: a deep-linked {focusMinutes:0} reaches here past the 15-min clamp →
  // 0/0 = NaN → width: 'NaN%'. Guard the denominator; a non-positive plan is
  // already immediate-overrun (elapsedMin >= 0), so a full bar is consistent.
  const progress =
    plannedFocusMinutes > 0
      ? Math.max(0, Math.min(1, elapsedMin / plannedFocusMinutes))
      : 1;

  // Progress bar fills toward the suggested stop; once we're in overrun it stops
  // at 100% (no separate "overrun fill" — that would look like a regression to
  // a new phase). The label flip carries the state.
  return (
    <View style={styles.root}>
      <View
        style={[styles.track, { backgroundColor: theme.border }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <View
          style={[
            styles.fill,
            {
              backgroundColor: overrun ? theme.textMuted : theme.accent,
              width: `${progress * 100}%`,
            },
          ]}
        />
      </View>
      <Text variant="caption" color={theme.textMuted}>
        {overrun
          ? `Overrun · +${overrunMin} min`
          : `Suggested stop · ${left} min left`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch', alignItems: 'center', gap: 8 },
  track: {
    alignSelf: 'stretch',
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  fill: { height: 2, borderRadius: 1 },
});
