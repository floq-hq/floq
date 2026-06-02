# Bug audit — end of Week 5 (+ S6.0)

> **Created:** 2026-05-29 · **Scope:** W1–W5 frontend + S6.0 shareable card.
> **Method:** multi-agent sweep (8 dimensions × 3 rounds, loop-until-dry), every
> finding cross-checked by 2 independent adversarial verifiers. `2/2` = both
> verifiers confirmed; `1/2` = one confirmed, one skeptical (lower confidence).
> **Status:** in progress — **18/32 fixed**. The 2 🔴 HIGH (2026-05-29) + the entire **[MOHAMED]** backlog (2026-05-30, PRs #135/#136/#137) + four [MUSTAFA] items reconciled 2026-06-02: **#4, #5, #7 were silently closed by Mohamed's W6 frontend PRs (#165/#170)** and **#6 fixed directly**. **Every remaining open item is [MUSTAFA] or [SHARED]** — no pure [MOHAMED] item is open.

**Ownership legend**
- **[MUSTAFA]** — frontend (`app/`, `components/`, stores, `services/{tasks,llm,share,onboarding,notifications}`, theme).
- **[MOHAMED]** — `services/{timer,ml,session,storage}`, `firebase/auth`, `models/`, `services/stats/aggregations`. Hand off — Mustafa must not edit without Mohamed's approval.
- **[SHARED]** — a Mustafa screen calling a Mohamed service; the two must coordinate.

> 32 confirmed. **Update 2026-06-02 (reconciled against the #135–180 sync):** 18/32 fixed. Several "open" [MUSTAFA] items were already closed by Mohamed's W6 frontend PRs — verified against current code: **#4 (#165), #5 (#170), #7 (#170)** done; **#6** fixed directly this pass. Re-verified STILL OPEN: **#3** (`SessionCardModal:56` still includes the current session in the baseline) and **#8** (1/2, `tasks/persist` read path still MMKV). Genuinely-open [MUSTAFA]: #3, #8 (both edge cases). The 4 [SHARED] items (#9–#12) need a quick Mohamed sync (auth/session/notifications). Nothing in the audit blocks W6 or W7.

---

## 🔴 HIGH — boot / crash lockouts

- [x] **1. [MUSTAFA] Onboarding boot hangs forever when offline** — `stores/useOnboardingStore.ts:51` (2/2) ✅ fixed 2026-05-29
  `hydrate()` has no try/catch. Offline + empty MMKV (fresh install / post-sign-out / new account on device) → `loadOnboarding`'s Firestore `getDoc` rejects (`unavailable`) → `set({hydrated:true})` never runs → root gate (`app/index.tsx:97`) stuck on the splash spinner permanently.
  **Fix:** wrap the await in try/catch; on failure still `set({ answers: null, draft: loadDraft(), hydrated: true })` (or make `loadOnboarding` swallow Firestore errors → null).
  **Done:** wrapped the await in try/catch; on failure sets `{ answers: null, draft: loadDraft(), hydrated: true }` so the boot gate routes into onboarding instead of spinning.

- [x] **2. [MUSTAFA] Brain-dump crashes instead of falling back to manual entry** — `services/llm/parseTasks.ts:23` (2/2) ✅ fixed 2026-05-29
  `try/catch` only wraps `JSON.parse`, not the next line. A provider returning literal `null` → `(null).tasks` throws `TypeError`, escapes `validateTasks` AND `parseTasks` → breaks the "never let bad JSON reach UI; fall back to manual" contract.
  **Fix:** null/object-guard before property access, or wrap the whole `validateTasks` body in try/catch returning `null`.
  **Done:** guarded the property access — non-object/`null` now flows to `safeParse` → `null` → manual-entry fallback, no throw.

---

## 🟠 MEDIUM

### [MUSTAFA]
- [ ] **3. Share "% above average" includes the current session in its own average** — `components/session/SessionCardModal.tsx:56` (2/2)
  `focus.tsx` saves the session to SQLite *before* navigating to summary, so `meanScore(getFocusScoreSeries())` includes the just-finished score. Prior `[60]` + this `80` → should be 33% (per `sessionInsight.test.ts:22`), app shows 14%.
  **Fix:** exclude current session from the baseline (`getFocusScoreSeriesExcluding(id)`, or drop most-recent, or thread prior-average through).
  **Re-verified 2026-06-02:** STILL OPEN — `SessionCardModal:56` still reads the full `getFocusScoreSeries()` baseline (line moved in the #170 redesign, bug unchanged).

- [x] **4. Session-tab START failures are silent** — `app/(tabs)/session.tsx:43` (2/2) ✅ fixed 2026-05-31 (#165)
  Destructures only `{onStart,launching,showIntro,onIntroDismiss}` — drops `launchError` that Home renders. Same regression PR4 #4 fixed, but on the Session tab (a primary START entry). Dead button, no feedback.
  **Fix:** destructure + render the `launchError` danger caption like `home.tsx`.
  **Done:** the Home-redesign launchpad (`session.tsx:43`) now destructures `launchError` and renders it as a danger caption (`session.tsx:121`).

- [x] **5. Share failure is silent** — `components/session/SessionCardModal.tsx:65` (2/2) ✅ fixed 2026-05-31 (#170)
  `onShare` discards the `'shared'|'dismissed'|'failed'` result `shareSessionCard` deliberately returns. On capture failure the spinner just stops.
  **Fix:** `const r = await shareSessionCard(cardRef); if (r==='failed') { surface a toast/inline message }`.
  **Done:** the share-card redesign surfaces the result — `if (result === 'failed') setError(true)` (`SessionCardModal:65`).

- [x] **6. Task queue hangs / blanks on any SQLite fault** — `stores/useTaskStore.ts:83` (2/2) ✅ fixed 2026-06-02
  `hydrate()` has no try/catch; `loadTasks()` → `getDb()`/migrations can throw (corrupt DB, full disk) → `hydrated` never flips, queue stays `[]`, retries keep re-throwing. Same class as #1, different store.
  **Fix:** try/catch; set `hydrated:true` with empty/last-known queue; optionally fall back to the MMKV cache.
  **Done:** wrapped `hydrate` in try/catch; on a read fault it releases the gate with an empty queue (`set({ tasks: [], hydrated: true })`) so the next successful write/sync repopulates — mirrors the #1 onboarding fix.

- [x] **7. Forecast caption can render "-13 more sessions"** — `components/stats/ForecastSection.tsx` (1/2) ✅ fixed 2026-05-31 (#170)
  Cold branch is `state==='cold' || shownForecast==null`. If the forecast query errors/loads-late while `count>=7`, it renders `MIN_SESSIONS_FOR_FORECAST - count` (negative).
  **Fix:** only show the unlock-countdown when `state==='cold'`; neutral placeholder when forecast null but count≥7. Clamp with `Math.max(0,…)`.
  **Done:** the S6.1 rewrite added the 3-state `forecastSectionView` — the unlock countdown renders ONLY when truly cold (count 0–6, always positive); a gated-in-but-null shape gets a neutral placeholder.

- [ ] **8. `loadTasks` reads MMKV not SQLite → can delete live tasks from the Firestore mirror** — `services/tasks/persist.ts:50` (1/2)
  Read path + mirror delete-diff baseline both come from the MMKV cache, written as a separate step after SQLite. A failed/partial cache write → stale baseline → `mirrorTasks` deletes still-live ids from `users/{uid}/tasks`.
  **Fix:** read path + diff baseline from SQLite (`readAllTasks`); fall back to cache only pre-import.

### [SHARED] — Mustafa + Mohamed coordinate
- [ ] **9. Sub-5-min session fires "Recovery's almost up" push ~1s after DONE** — `app/focus.tsx:229` + `services/notifications/index.ts:55` (2/2)
  `breakMinutes:0` (L21) → `scheduleBreakReminder(0)` floors to 1s; summary routes straight Home so nothing cancels it.
  **Fix:** `if (completed.plan.breakMinutes > 0) scheduleBreakReminder(...) else cancelBreakReminder()` in `onDone`.

- [ ] **10. Android hardware-back escapes the no-escape /focus takeover** — `app/_layout.tsx:35` (2/2)
  `gestureEnabled:false` doesn't cover the Android system back button; no `BackHandler` anywhere → back pops /focus, leaving the session live, no record written.
  **Fix:** register `BackHandler` on /focus (no-op or route through End-early). Consider /recovery + /session-summary too.

- [ ] **11. Sign-up partial failure orphans the account** — `app/(auth)/sign-up.tsx:34` + `services/firebase/auth.ts:78` (2/2)
  `createUser` signs in immediately; if `updateProfile`/`ensureUserDoc` then throw (offline blip), screen shows "could not create account" — re-tap → "already registered." Half-provisioned doc.
  **Fix:** treat post-create failures as non-fatal; if `auth.currentUser` exists, route forward and retry `ensureUserDoc` lazily.

- [ ] **12. Resume from restore prompt can land on Home instead of /focus** — `components/session/RestoreSessionPrompt.tsx:46` + `app/index.tsx` (1/2)
  `onResume` does `replace('/focus')` then `onResolved()` → clears `restorable` → Index re-renders and `<Redirect href="/home">` races the imperative nav.
  **Fix:** don't clear `restorable` on the Resume branch; let /focus take over.

### [MOHAMED] — hand off
- [x] **13. Phase pill shows "RECOVERY" while actively focusing in overrun** — `app/focus.tsx:142` (2/2) ✅ fixed 2026-05-30 (#136)
  `phaseFor` returns `recovery` at `focusMinutes*60`; contradicts the L16 SuggestedStopMeter "stays Flow past suggested time" invariant. Fix in `app/focus.tsx` (clamp `recovery`→`flow` for display); **phases.ts stays frozen**.
  **Done:** new pure `components/session/displayPhase.ts` clamps `recovery → flow` for the /focus pill only; `phases.ts` untouched.
- [x] **14. ⚠️ Sign-out leaks prior user's session history to the next account** — `services/firebase/auth.ts:158` + `services/storage/sessions.ts` (2/2) ✅ fixed 2026-05-30 (#135)
  SQLite `sessions`/`distractions` never cleared on sign-out; reads have no uid filter → the next user's hero score, forecast, streak, best-session (carrying the prior user's private task title) + cold-start fatigue all include the prior user. **Security-relevant; NOT the deferred task-isolation item.** Fix: clear sessions+distractions on sign-out (mirror `deleteAllTasks`), or add uid column + filter.
  **Done:** new `deleteAllSessions()` (clears distractions + sessions in one txn) called in `signOut()` (auth.ts:218) alongside `deleteAllTrainingSamples()`. Per-user isolation (uid column) stays deferred; this closes the leak.
- [x] **15. ⚠️ Restore-save writes wall-clock-inflated minutes into SQLite** — `services/session/finalize.ts:27` (2/2) ✅ fixed 2026-05-30 (#135)
  `finalizeOnAbandon` credits `minutesBetween(startedAt, now)`; app killed mid-session & reopened a day later → hundreds of minutes + inflated score persisted, skews stats forever. Fix: cap credited focus at planned length (or use a last-foreground timestamp).
  **Done:** confined to the restore path — `restore.ts` caps `endedAt = min(now, startedAt + planned·60s)`. The live end-early path (`abandonSession`) and `finalize` are unchanged (a present user may legitimately overrun).
- [x] **16. "Start next session" silently no-ops in production** — `app/recovery.tsx:136` (2/2) ✅ fixed 2026-05-30 (#137)
  `computeSessionPlan` throw only logged in `__DEV__`; prod = dead CTA. Fix: surface an error / route Home.
  **Done:** the throw now surfaces an inline error; Skip-recovery → Home stays the escape hatch.
- [x] **17. `signInWithEmail` never ensures the user doc** — `services/firebase/auth.ts:89` (1/2) ✅ fixed 2026-05-30 (#137)
  Other two auth paths call `ensureUserDoc`; this one doesn't → doc can lack `privacy:'private'` (security default) + `has_seen_intro`. Fix: call `ensureUserDoc` after email sign-in.
  **Done:** new shared `ensureUserDocBestEffort` wrapper now runs after email sign-in (and covers the Google path, #31).

---

## 🟡 LOW — edge cases / polish

### [MUSTAFA]
- [ ] **18. Session-end share card never gets the time-of-day insight** — `app/session-summary.tsx:65` + `app/focus.tsx:233` (2/2). `startedAt` not forwarded → insight branch #4 can't fire; differs from the Stats-tab card. Fix: forward `startedAt` param.
- [ ] **19. NaN `score` param renders "NaN" hero + still shows Share** — `app/session-summary.tsx:54` (2/2). `Number(badString)` = NaN, `NaN != null` true. Fix: `Number.isFinite(n) ? n : null`.
- [ ] **20. Loading conflated with empty on all stats cards** — `components/stats/HeroScore.tsx:21` (+ SummaryCards, PersonalBest) (2/2). TanStack `data===undefined` on first render; `undefined == null` true → returning users flash "no sessions yet" / zeros. Fix: branch on `isPending`, distinguish `undefined` (loading) from `null` (empty).
- [ ] **21. PersonalBest a11y label drops the "score" unit** — `components/stats/PersonalBest.tsx:96` (2/2). Visual shows `unit ?? 'score'`; label omits it when `unit` undefined. Fix: mirror the `?? 'score'` fallback in the label.
- [ ] **22. Task mirror exceeds Firestore's 500-op batch** — `services/tasks/firestoreMirror.ts:32` (2/2). >500 tasks → `batch.commit()` rejects (swallowed), mirror diverges. Fix: chunk into ≤500-op batches.
- [ ] **23. `/dev` route reachable in production builds** — `app/dev.tsx:16` (2/2). Auto-registers; not `__DEV__`-gated despite the comment. `floq://dev` shows internal harnesses in release. Fix: `if (!__DEV__) return <Redirect href="/home" />`.
- [x] **24. FloqTabBar indicator flashes off-screen-left on first paint** — `components/FloqTabBar.tsx:127` (1/2) ✅ fixed 2026-05-30 (#137). `moveTo` runs before layout (`cellWidth=0`) → animates to x≈-15 then snaps. Fix: no-op `moveTo` until `cellWidth>0`. *(from the tab-bar PR, not S5.x/S6.0.)* **Done:** pure `indicatorTranslateX` returns `null` until measured; `moveTo` no-ops pre-layout, seats instantly on first/rotated layout.
- [ ] **25. Sign-out failure no feedback** — `app/(tabs)/more.tsx:22` (2/2). No catch around `signOut()`; if it rejects, nothing happens, the user stays signed in silently. Fix: try/catch + inline error.

### [MOHAMED]
- [x] **26. Deep-link plan with no task freezes timer at 00:00** — `app/focus.tsx:166` (2/2) ✅ fixed 2026-05-30 (#136). Valid `plan` + missing task → early-return, clock never starts, live-looking UI stuck. **Done:** fallback view now guards `!plan || !task`; normal start + Resume keep `task` non-null, so only a true no-task deep link hits the inert fallback.
- [x] **27. SuggestedStopMeter NaN width when `plannedFocusMinutes=0`** — `components/session/SuggestedStopMeter.tsx:47` (2/2) ✅ fixed 2026-05-30 (#136). `0/0` → `'NaN%'`. **Done:** denominator guarded — a non-positive plan is immediate-overrun, so a full bar is consistent.
- [x] **28. `weekStartMs` 1h off across a DST boundary** — `services/stats/aggregations.ts:49` (2/2) ✅ fixed 2026-05-30 (#137). Naive `localMidnight(now) - 6*DAY_MS` instead of the calendar-aware helper the file documents. **Done:** now walks the calendar-aware `prevDayMidnight` ×6 (DST tests forced to `America/New_York`).
- [x] **29. Recovery countdown misaligned ~8s vs the notification** — `app/recovery.tsx:99` (2/2) ✅ fixed 2026-05-30 (#137). Countdown anchors to recovery-mount; notification scheduled at DONE; summary dwells 8s. **Done:** DONE timestamp now threads focus.tsx → summary → recovery and anchors the countdown.
- [x] **30. Break-reminder schedule/cancel race on fast skip** — `app/recovery.tsx:135` + `app/focus.tsx:229` (2/2) ✅ fixed 2026-05-30 (#137). `void scheduleBreakReminder` not awaited; a fast Skip/Start-next can `cancel` before the schedule registers → notification survives into Session 2. **Done:** `cancelBreakReminder` now awaits the in-flight schedule before sweeping, so the cancel always lands after the notification registers.
- [x] **31. Google sign-in shows error while actually signed in** — `app/(auth)/welcome.tsx:24` + `services/firebase/auth.ts:117` (2/2) ✅ fixed 2026-05-30 (#137). `ensureUserDoc` failure after `signInWithCredential` shows "could not continue with Google" then the gate navigates the user in. **Done:** shared `ensureUserDocBestEffort` wrapper makes the skeleton write best-effort post-auth.

> Note: #16 and a near-duplicate at `recovery.tsx:135` ("Start next session no-op + break reminder already cancelled") are the same recovery start-next defect — fix once.

---

## Not yet reviewed (the sweep flagged these gaps — worth a 2nd pass)
- Onboarding screens `app/(onboarding)/{q1..q4,ready,_layout}.tsx` + `QuestionScaffold` (q3's local-mirror-of-store-draft stale-state risk; Back/step-from-pathname logic).
- **Theme module** (`theme/*`) — token completeness across both themes; any component referencing a token missing on one theme.
- **UI primitives** (`components/ui/*`) — Slider (native), TextField, Button states; **SegmentedControl renders no selection when `value` undefined** (q3 relies on it — confirm Continue is gated).
- Brain-dump/manual UI (`BrainDumpModal` temp-id `p${Date.now()}-${i}` collision on re-Organize; `DraggableTaskList` reorder).
- Session sub-components reanimated/timer cleanup (`SessionToast` setTimeout, `EndEarlySheet` `setTimeout(exitToHome,800)` after unmount, `PhaseIndicator`/`SessionTimer` worklets).
- `services/notifications/index.ts` internals (permission gating, `cancelByKind` dedup, module `configured` flag, trigger correctness across relaunch).
- `app/(tabs)/partner.tsx` stub, `OfflineIndicator`/`FirstSessionFramingCard`/`services/intro/seen.ts`, and `app/_layout.tsx`/`index.tsx` boot side-effect ordering.
