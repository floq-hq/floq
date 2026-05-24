# mobile/ — CLAUDE.md

Frontend-specific guidance. Inherits everything from the root `CLAUDE.md` — read that first.

## You are working in the Expo / React Native app

If the task is not about UI, screens, components, navigation, or the React side of services — stop and check whether you should be in `ml/` or `backend/` instead.

## Stack reminders



- Expo Router (file-based). Screens live in `app/`. Bottom tabs: Home, Session, Stats, Friends.
- TypeScript strict. No `any` without a `// reason: ...` comment on the same line.
- Zustand for client state. One store per concern (`useSessionStore`, `useOnboardingStore`, `useTaskStore`, `useUserStore`). No mega-store.
- TanStack Query for anything that reads from Firestore. Keys must be arrays, not strings.
- MMKV for prefs (theme, onboarding seed, `has_seen_intro`). SQLite for session history.
- react-native-reanimated for the timer tick. **The tick must not setState on the JS thread.** Use `useSharedValue` + `useDerivedValue` and only update React state at phase transitions.

## Component conventions

- Function components only. No classes.
- Co-locate component + styles + types in one file unless the file would exceed ~200 lines.
- Styles via `StyleSheet.create`. No inline objects in JSX (causes re-renders).
- Memoize anything that takes objects or arrays as props with `React.memo` and pass primitives where possible.
- Lists with >10 items use FlashList, not FlatList.

## Design system

Lives in `mobile/theme/`. Full spec — typography, color tokens, dual themes, phase colors, implementation rules — in `shared/spec/design-system.md`. Build the theme module in W1 before any screens.

- `theme/colors.ts` — semantic tokens (`bg`, `bgElevated`, `text`, `textMuted`, `accent`, `success`, `danger`, `phase.struggle`, `phase.release`, `phase.flow`, `phase.recovery`).
- `theme/typography.ts` — type scale.
- `theme/spacing.ts` — 4pt grid.
- `components/ui/` — Button, Card, Pill, Slider, SegmentedControl, ProgressRing.


Build the design system in W1 before any screens. The blueprint flags this as critical — RN apps look generic without it.

## Screen-specific notes

### Home
- Single task visible at top — title, est. minutes, difficulty pill.
- Hint text if more tasks exist: `+3 hidden`.
- Streak counter, top right.
- Large `START SESSION` button.
- Brain-dump entry via `+` button (modal with text input + voice).

### Session
- Phase indicator pill at top, color follows `theme.colors.phase[currentPhase]`.
- Large timer in the center (Reanimated, off-JS-thread).
- Task name under the timer.
- Always-visible `GOT DISTRACTED` button. One tap, no confirm.
- `DONE` button.
- **No pause button.** Pausing IS a distraction (see root spec).
- App backgrounded > 30s while in session → log a distraction. (Confirm with `shared/spec/decisions.md`.)

### Stats
- Hero number: weekly focus score.
- Performance graph (Victory Native): past sessions + dashed forecast.
- Regime-gated: hide forecast when `sessions_done < 7`. Show with wide bands at 7–13. Tight bands at 14+.
- Empty state for cold regime: "We're still learning your rhythm."

### Friends
- Friends-only leaderboard (weekly, opt-in).
- Async session feed cards: `{name} just completed {n} min — score {s}`.
- Friend profile = score + streak only. **Never expose task names across users.**

## First-session framing card

Shown exactly once, gated on `users.has_seen_intro = false` in Firestore (mirror in MMKV for offline).

4 steps. Single `Got it, let's go` button at the end. Optional info icon on session screen for re-surfacing later.

Content lives in `app/_session-intro.tsx` and the copy is in `shared/spec/onboarding.md`.

## Empty / error states (don't skip)

- No tasks → friendly nudge to brain-dump.
- Offline → cached tasks visible, sync indicator.
- LLM failure → fall back to manual task entry form.
- No friends yet → empty leaderboard with "add a friend" CTA.
- Cold regime → "learning your rhythm" badge on stats.

## Performance budget

- App cold start to interactive Home: < 2s on iPhone 12.
- Session screen timer tick: 60fps, no dropped frames over a 90-min session.
- Bundle size: < 25 MB before TFLite model. TFLite model: < 2 MB.

## Don't do

- Don't add a navigation library other than Expo Router.
- Don't add a styling library (NativeWind, styled-components, restyle). Plain StyleSheet + tokens.
- Don't fetch in screen components. Wrap with a TanStack Query hook in `services/`.
- Don't use `useEffect` to drive the timer. Reanimated handles it.
- Don't put business logic in screens. Push it down to `services/`.
