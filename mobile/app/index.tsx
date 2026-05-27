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
import { useSettingsStore } from '../stores/useSettingsStore';
import type { OnboardingAnswers } from '../services/onboarding';
import { useTheme } from '../theme';

/**
 * First unanswered question for an unfinished onboarding, so a kill mid-flow
 * resumes where the user left off (S2.1) rather than restarting at Q1. Once all
 * four are in the draft, send to the finalize step. Relies on the store
 * hydrating the persisted draft (services/onboarding/persist `loadDraft`).
 */
function onboardingResumeHref(draft: Partial<OnboardingAnswers>): string {
  if (draft.base_focus === undefined) return '/(onboarding)/q1';
  if (draft.distraction_level === undefined) return '/(onboarding)/q2';
  if (draft.preferred_time === undefined) return '/(onboarding)/q3';
  if (draft.use_case === undefined) return '/(onboarding)/q4';
  return '/(onboarding)/ready';
}

export default function Index() {
  const theme = useTheme();
  const { user, initializing } = useCurrentUser();
  const answers = useOnboardingStore((s) => s.answers);
  const draft = useOnboardingStore((s) => s.draft);
  const hydrated = useOnboardingStore((s) => s.hydrated);
  const hydrate = useOnboardingStore((s) => s.hydrate);
  const settingsHydrated = useSettingsStore((s) => s.hydrated);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);

  // Load the seed once we know who's signed in (gates onboarding vs home).
  useEffect(() => {
    if (user && !hydrated) void hydrate(user.uid);
  }, [user, hydrated, hydrate]);

  // Load app settings once at launch so the background-during-session policy
  // (S3.5 / M3.4) is in effect for sessions even before the user opens Settings.
  useEffect(() => {
    if (!settingsHydrated) hydrateSettings();
  }, [settingsHydrated, hydrateSettings]);

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
        ? onboardingResumeHref(draft)
        : '/home';
  return <Redirect href={href} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
