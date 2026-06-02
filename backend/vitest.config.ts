import { defineConfig } from 'vitest/config';

// Rules tests talk to the Firestore emulator over the network, so they must run
// serially (a shared emulator instance) and need a generous timeout for the
// first cold connection. `firebase emulators:exec` sets FIRESTORE_EMULATOR_HOST.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.rules.test.ts'],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
