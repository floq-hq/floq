/**
 * TabHeader — the ONE header shell for the non-Home tabs (Session / Stats /
 * Partner / More). Before this, each tab hand-rolled its own header with
 * different top insets (10 / 12 / 56), horizontal padding (20 / 24), and some
 * (Stats) let the title scroll away — so headers sat at different heights and
 * Session had none at all.
 *
 * This fixes the skeleton: a PINNED row at a consistent height — `insets.top +
 * TOP_GAP` matching Home's header, `PADDING` (20) matching Home's gutter, the
 * `title` type token, and an offline indicator on the right (hidden when online,
 * no layout shift). Home keeps its distinct wordmark + date + avatar header by
 * design (owner call); these values are chosen to line up with it so tab
 * switches don't jump.
 *
 * design-system.md: calm, low-noise — no divider, just spacing; tokens only.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from './ui';
import { OfflineIndicator } from './OfflineIndicator';

/** Matches Home's header gutter + top inset so all tabs align. */
export const TAB_PADDING = 20;
const TOP_GAP = 10;

type Props = {
  title: string;
  /** Optional extra control rendered left of the offline indicator. */
  right?: ReactNode;
};

export function TabHeader({ title, right }: Props) {
  return (
    <View style={styles.header}>
      <Text variant="title">{title}</Text>
      <View style={styles.right}>
        {right}
        <OfflineIndicator />
      </View>
    </View>
  );
}

/** Top padding a tab screen's root should use so its TabHeader clears the
 *  status bar at the same height as Home. Pass the safe-area top inset. */
export function tabHeaderTopPadding(insetTop: number): number {
  return insetTop + TOP_GAP;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
    marginBottom: 16,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
