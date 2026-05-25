/**
 * Auth stack. Calm fade transitions per the design system (no spring bounce);
 * headers hidden — each screen renders its own header copy.
 */
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
