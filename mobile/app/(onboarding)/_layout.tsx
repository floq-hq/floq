/**
 * Onboarding stack (S2.1). Calm fade transitions (matching the auth stack) and
 * a persistent progress header: a 4-dot indicator for Q1–Q4 plus a Back control.
 *
 * The header lives here — not in each screen — so progress reads continuously
 * across the flow instead of re-animating on every navigation. The current step
 * is derived from the active route; the terminal `ready` screen shows no dots.
 */
import { Stack, router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/ui';
import { useTheme } from '../../theme';

const STEPS = ['q1', 'q2', 'q3', 'q4'] as const;

/** Active question number (1–4) from the route, or null on non-question screens. */
function stepFromPath(pathname: string): number | null {
  const last = pathname.split('/').filter(Boolean).pop();
  const i = STEPS.indexOf(last as (typeof STEPS)[number]);
  return i === -1 ? null : i + 1;
}

export default function OnboardingLayout() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const step = stepFromPath(usePathname());
  const canGoBack = router.canGoBack();

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {canGoBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.back}
          >
            <Text variant="label" color={theme.textMuted}>
              Back
            </Text>
          </Pressable>
        ) : null}

        {step !== null ? (
          <View style={styles.dots}>
            {STEPS.map((_, i) => {
              const n = i + 1;
              const filled = n <= step;
              return (
                <View
                  key={n}
                  style={[
                    styles.dot,
                    n === step ? styles.dotCurrent : null,
                    { backgroundColor: filled ? theme.accent : theme.border },
                  ]}
                />
              );
            })}
          </View>
        ) : null}
      </View>

      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: theme.bg },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: undefined,
    paddingBottom: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { position: 'absolute', left: 24, bottom: 10 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotCurrent: { width: 22 }, // current step reads as a pill
});
