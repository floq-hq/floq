/**
 * Root layout. Wraps the whole app in SafeArea + the design-system ThemeProvider
 * (sync MMKV read = no flash of wrong theme) and renders the native Stack. All
 * screens are headerless by default and paint the themed background, so route
 * transitions never flash white.
 */
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../theme';

function ThemedStack() {
  const theme = useTheme();
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        {/* All other routes auto-register from the file tree; only these need an
            explicit override. */}
        <Stack.Screen name="brain-dump" options={{ presentation: 'modal' }} />
        <Stack.Screen name="task-queue" options={{ presentation: 'modal' }} />
        {/* An active session is a no-escape route — DONE (S3.3) is the only way
            out, so the swipe-back gesture is disabled. */}
        <Stack.Screen name="session" options={{ gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    // GestureHandlerRootView must wrap the whole app for gesture-handler (swipe
    // to delete, drag to reorder in the task queue) to receive touches.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedStack />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
