import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The timer service is a pure leaf — no RN/jsdom environment needed.
    environment: 'node',
    include: ['services/**/__tests__/**/*.test.ts'],
  },
});
