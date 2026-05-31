# Stats — post-MVP roadmap (beyond the forecast)

> **Status:** post-MVP, not scheduled into W1–W8. The MVP Stats tab ships: weekly
> focus-score hero, personal best, recent sessions, and the regime-gated
> **forecast** (Holt's linear — `decisions.md` L8, `docs/forecast-encoder.md`).
> The forecast is **one** analysis; this doc captures the much larger Stats
> surface we want once there's data + time. Each item below is computable from
> data we ALREADY capture per session.

## Data we already have (per `CompletedSession`)

`focusScore` (un-clamped), `actualFocusMinutes`, `distractions[]` (timestamps),
`plan` (focusMinutes / breakMinutes / regime), `startedAt` / `endedAt`,
`completed`, `overrunMinutes`, `task.difficulty` + `estMinutes`, derived phase
segments. All on-device (SQLite); aggregation is local unless noted.

**Privacy invariant (L4):** task **titles** never appear in any shared/partner
surface. Per-user analytics on-device may use everything; anything partner-visible
is the derived `social` summary only.

## Analyses to add (roughly prioritized)

### 1. Temporal performance ("when are you good?")
- Focus score + minutes broken down by **time-of-day** (morning/afternoon/
  evening/night) and **day-of-week** — "your Tue mornings run 18% above average".
- **Best focus window** callout; weakest window.
- Circadian view once a wake anchor exists (ties to open decision **O10**).

### 2. Consistency & cadence
- Sessions/week trend, current vs longest **streak**, gaps, time-of-day regularity.
- **Recovery adherence** — actual break vs recommended (the L17 `recovery_mod`
  made visible): are you skipping recovery and paying for it next session?

### 3. Distraction analytics
- Distractions/session **trend**; distraction **rate** by time-of-day.
- **Within-session timing** — do distractions cluster early (struggle) or late
  (fatigue)? (We have per-distraction timestamps.)
- Distraction-free-session rate + streak.

### 4. Phase analytics (the four-phase model, measured)
- **Time-to-flow** (how long struggle lasts for you), % of sessions that reach
  flow, average flow minutes, flow-minutes trend.
- **Overrun patterns** — how far past the suggested stop you tend to go (L16).

### 5. Estimation calibration
- **Estimated vs actual** minutes per task — are you an optimist? A calibration
  scatter / bias number. Feeds better recommendations over time.
- Focus score vs **task difficulty** correlation.

### 6. Records, milestones & totals
- Lifetime **total focus hours**, longest session, highest score, most flow, best
  week. Milestone timeline (anti-gamified: facts, not badges — design-system).

### 7. Trends over time
- Weekly / monthly focus-score + minutes trend with rolling averages.
- **Regime journey** — the cold → warming → mature progression as a story.

### 8. Goals / beat-self
- Beat-self targets (already named in `ml-regimes.md` for the mature regime),
  week-over-week deltas, progress toward a self-set weekly focus goal.

### 9. Insight engine (the narrative layer)
- Auto-generated, honest one-liners across all the above ("you focus best before
  noon", "Wednesdays are your weakest day", "0 distractions 4 sessions running").
- This is the natural home for an **LLM-written narrative** over the computed
  stats (numbers stay locally computed + verified; the LLM only phrases them) and,
  later, the **cross-user encoder** (`docs/forecast-encoder.md`) for predictions.

### 10. Partner / social (post-W7, per L18)
- Pair comparison + pair-streak analytics — **summaries only**, never task titles;
  opt-in at pairing, cleared when the partnership ends.

## Sequencing notes
- Items 1–7 are **pure on-device aggregations** — shippable incrementally without
  any data egress, right after the MVP.
- Item 9's LLM layer + item 10 depend on the L23 telemetry / partnership work.
- Keep the aesthetic: **calm, scientific, anti-gamified** — these are instruments,
  not trophies (design-system.md). No leaderboards, no streak-on-fire.
