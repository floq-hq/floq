/**
 * MenuSection — a small uppercase muted header above a gap-stacked group of
 * MenuRows (the WHOOP "ACCOUNT & SETTINGS" / "SUPPORT" grouping). Header is
 * optional so a group can stand alone.
 */
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../../theme';

export function MenuSection({ title, children }: { title?: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      {title ? (
        <Text variant="label" color={theme.textMuted} style={styles.title}>
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View style={styles.rows}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  title: { letterSpacing: 0.5, paddingHorizontal: 4 },
  rows: { gap: 10 },
});
