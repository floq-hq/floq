/**
 * Root gate. Encodes M2.4's `resolveStartRoute` decision for a booting app:
 *   not signed in        -> (auth)/welcome
 *   signed in, no seed    -> (onboarding)/q1
 *   signed in, onboarded  -> /home
 *
 * Auth state and the onboarding seed both load async, so we hold on a
 * splash-colored view until both are known, then redirect exactly once.
 */
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { resolveStartRoute, useCurrentUser } from '../services/firebase';
import { useOnboardingStore } from '../stores/useOnboardingStore';
import { useTheme } from '../theme';

export default function Index() {
  const theme = useTheme();
  const { user, initializing } = useCurrentUser();
  const answers = useOnboardingStore((s) => s.answers);
  const hydrated = useOnboardingStore((s) => s.hydrated);
  const hydrate = useOnboardingStore((s) => s.hydrate);

  // Load the seed once we know who's signed in (gates onboarding vs home).
  useEffect(() => {
    if (user && !hydrated) void hydrate(user.uid);
  }, [user, hydrated, hydrate]);

  const waiting = initializing || (!!user && !hydrated);
  if (waiting) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  const route = resolveStartRoute({ user, onboardingComplete: answers !== null });
  const href =
    route === 'auth'
      ? '/(auth)/welcome'
      : route === 'onboarding'
        ? '/(onboarding)/q1'
        : '/home';
  return <Redirect href={href} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
