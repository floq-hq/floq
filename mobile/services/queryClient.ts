// Shared TanStack Query client (M4.3).
//
// One QueryClient for the whole app — mounted by `<QueryClientProvider>` in
// app/_layout.tsx (wired by S4.1, the Stats screen). Stats reads (M4.3) are the
// first consumer; future Firestore reads (per mobile/CLAUDE.md: "TanStack Query
// for anything that reads from Firestore") use the same client.
//
// Tuning: stats queries hit SQLite synchronously — `staleTime: 30s` keeps the
// Stats screen from re-running the aggregation on every focus/remount while
// still picking up freshly-saved sessions within a normal cadence. After a
// session is saved (saveCompletedSession), the writer should invalidate
// ['stats'] so the numbers refresh immediately — wired in the S3.3 Done handler
// (out of scope for this M-task; see PR body).

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 0, // SQLite reads don't fail transiently; surface the error instead of looping.
      refetchOnWindowFocus: false, // RN: no window-focus events; refetch on app-foreground later if needed.
    },
  },
});
