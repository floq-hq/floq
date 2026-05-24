# shared/spec/science.md

Every constant in `timer.md` traces back to peer-reviewed research on focus and flow. This file is the citation trail. **Do not change a constant without updating its citation here.**

## Fact 1 — Flow is a four-stage cycle

Flow is not binary. Csikszentmihalyi (1990) and follow-up research identifies four stages:

- **Struggle** — loading information, cognitive friction. Lasts 20–30 minutes. Feels like failure but is the necessary on-ramp.
- **Release** — brain lets go of the friction. Brief transitional phase.
- **Flow** — peak attention, time distortion, intrinsic reward.
- **Recovery** — required after flow. Prefrontal cortex replenishment.

**Implication for Floq:** the timer's phase indicator maps directly to these four stages. Never interrupt during Struggle.

## Fact 2 — Distraction costs ~23 minutes

Mark, Gloria, Iqbal et al., "The Cost of Interrupted Work: More Speed and Stress" (UC Irvine, 2008). Average time to fully recover focus after an interruption: ~23 minutes.

**Implication for Floq:** the focus-score formula deducts `distraction_count * 23` minutes from session minutes. The constant `23` is not tunable.

## Fact 3 — Ultradian rhythms ≈ 90 minutes

The brain operates on ultradian cycles of roughly 90–120 minutes (Kleitman, basic rest-activity cycle), governing peaks and troughs of alertness. Pushing past 90 minutes without a real break produces diminishing returns.

**Implication for Floq:**
- Focus session upper clamp: 90 minutes.
- Break ratio: ~22% of focus duration (90/20 → 0.22).
- Recovery clamp: 5–25 minutes.

## Fact 4 — Challenge must match skill

Flow occurs when task difficulty sits roughly 4% beyond current skill — challenging enough to demand attention, not so hard that anxiety floods the system (Csikszentmihalyi; replicated in Nakamura & Csikszentmihalyi, 2002).

**Implication for Floq:**
- Tasks are classified 1–5 by difficulty (LLM-assigned).
- `difficulty_mod = 0.85` for hard tasks — slightly shorter sessions so the user doesn't burn out on a hard task at the start.
- `difficulty_mult = difficulty / 3.0` in the focus-score formula — completing a hard session is worth more.

## Why Pomodoro (25/5) is wrong for cognitive work

A 25-minute hard cap interrupts the user right when their brain is entering Release. The user has just paid the 20-minute Struggle tax and is about to enter Flow — and the timer rings. Cumulative effect: Pomodoro feels exhausting for cognitively demanding work because the user never reaches Flow.

This is the central design claim of Floq. **If you find yourself adding a 25-minute hard cap, you are building a different product.**

## Constants summary

| Constant | Value | Source |
|---|---|---|
| Struggle window | 0–20 min | Csikszentmihalyi |
| Flow upper bound | 90 min | Kleitman (ultradian) |
| Break ratio | 0.22 | 90/20 derivative |
| Distraction penalty | 23 min | Mark et al. 2008 |
| Hard-task modifier | 0.85 | Challenge-skill balance |
| Easy/neutral modifier | 1.0 | (baseline) |
| Distraction tendency: easy | 0.8 | Onboarding self-report mapping |
| Distraction tendency: neutral | 1.0 | (baseline) |
| Distraction tendency: hard | 1.15 | Onboarding self-report mapping |
| Fatigue mod (1st today) | 1.0 | (baseline) |
| Fatigue mod (2nd today) | 0.9 | Cognitive fatigue heuristic |
| Fatigue mod (3rd+ today) | 0.8 | Cognitive fatigue heuristic |
| Time-match mod (matches Q3) | 1.0 | (baseline) |
| Time-match mod (off-peak) | 0.85 | Circadian alertness variation |
| Focus clamp lower | 15 min | Below this, no flow possible |
| Focus clamp upper | 90 min | Ultradian upper bound |
| Break clamp lower | 5 min | Minimum useful recovery |
| Break clamp upper | 25 min | Beyond this, momentum lost |

If any of these change, update this table, cite the new source, and require sign-off in `decisions.md`.
