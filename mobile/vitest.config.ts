import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure-logic leaves (timer/onboarding services, Zustand stores) — no
    // RN/jsdom environment needed. UI component tests would need their own setup.
    environment: 'node',
    include: [
      'services/**/__tests__/**/*.test.ts',
      'stores/**/__tests__/**/*.test.ts',
      'models/**/__tests__/**/*.test.ts',
    ],
  },
});
