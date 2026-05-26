/**
 * Brain-dump modal route (S2.4). Presented modally (see the Stack.Screen
 * registration in app/_layout.tsx); opened by Home's "+" and the empty-state
 * CTA. The screen itself is BrainDumpModal — capture → parseTasks → review/save,
 * with a manual-entry fallback.
 */
import { router } from 'expo-router';
import { BrainDumpModal } from '../components/BrainDumpModal';

export default function BrainDumpRoute() {
  return <BrainDumpModal onClose={() => router.back()} />;
}
