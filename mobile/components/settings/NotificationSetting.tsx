/**
 * Notification preferences (S4.2) — two switches bound to useSettingsStore:
 *  - Break reminder: the end-of-recovery "Recovery's almost up" nudge.
 *  - Daily start reminder: the once-a-day nudge at your preferred time (Q3).
 *
 * The schedulers in services/notifications are gated on these prefs (off → never
 * scheduled). Turning a pref OFF here also cancels any already-scheduled reminder
 * immediately; turning it back ON reschedules on the next relevant event (a
 * session end for the break reminder, app open for the daily one).
 */
import { useEffect } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Text } from '../ui';
import { useTheme } from '../../theme';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { cancelBreakReminder, cancelSessionStartReminder } from '../../services/notifications';

interface Row {
  label: string;
  line: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

export function NotificationSetting() {
  const theme = useTheme();
  const breakEnabled = useSettingsStore((s) => s.settings.breakReminderEnabled);
  const startEnabled = useSettingsStore((s) => s.settings.sessionStartReminderEnabled);
  const setBreak = useSettingsStore((s) => s.setBreakReminderEnabled);
  const setStart = useSettingsStore((s) => s.setSessionStartReminderEnabled);
  const hydrated = useSettingsStore((s) => s.hydrated);
  const hydrate = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  const rows: Row[] = [
    {
      label: 'Break reminder',
      line: 'A nudge when your recovery break is nearly up.',
      value: breakEnabled,
      onChange: (next) => {
        setBreak(next);
        if (!next) void cancelBreakReminder();
      },
    },
    {
      label: 'Daily start reminder',
      line: 'A once-a-day nudge around when you like to focus.',
      value: startEnabled,
      onChange: (next) => {
        setStart(next);
        if (!next) void cancelSessionStartReminder();
      },
    },
  ];

  return (
    <View style={styles.section}>
      {rows.map((r) => (
        <View
          key={r.label}
          style={[styles.row, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}
        >
          <View style={styles.text}>
            <Text variant="bodyMedium">{r.label}</Text>
            <Text variant="caption" color={theme.textMuted}>
              {r.line}
            </Text>
          </View>
          <Switch
            value={r.value}
            onValueChange={r.onChange}
            trackColor={{ true: theme.accent, false: theme.border }}
            accessibilityLabel={r.label}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  text: { flex: 1, gap: 4 },
});
