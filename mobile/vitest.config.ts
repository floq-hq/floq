import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Pure-logic leaves (timer/onboarding services, Zustand stores) — no
    // RN/jsdom environment needed. The components glob is for PURE helpers
    // colocated with a component (e.g. components/stats/forecastUiState.ts):
    // node-safe, zero RN imports. A test that actually RENDERS a component still
    // needs its own jsdom/RN setup; `.test.ts` files here must stay pure.
    environment: 'node',
    include: [
      'services/**/__tests__/**/*.test.ts',
      'stores/**/__tests__/**/*.test.ts',
      'models/**/__tests__/**/*.test.ts',
      'components/**/__tests__/**/*.test.ts',
    ],
  },
});
