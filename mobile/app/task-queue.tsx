/**
 * Task queue modal route (S2.6). Presented modally (registered in app/_layout.tsx);
 * opened by Home's "+N hidden" caption. Renders the full-queue management sheet.
 */
import { router } from 'expo-router';
import { TaskQueueSheet } from '../components/TaskQueueSheet';

export default function TaskQueueRoute() {
  return <TaskQueueSheet onClose={() => router.back()} />;
}
