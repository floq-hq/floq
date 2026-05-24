# shared/spec/ml-regimes.md

Floq routes timer recommendations through one of three regimes depending on how much behavioral data the user has accumulated. This is the most important UX/ML design decision in the product: it lets the app degrade gracefully and earn the user's trust as data accumulates.

## Why three regimes

A new user with no behavioral data leads to one of two bad outcomes:

1. Generic 25/5 timer — betrays the whole premise of Floq.
2. Confident predictions from 1–2 sessions — makes the app look stupid and erodes trust.

The three-regime router avoids both.

## The router

Implemented in `mobile/services/ml/regimeRouter.ts`:

```ts
function pickRegime(sessionsCompleted: number): Regime {
  if (sessionsCompleted < 5)  return 'cold';
  if (sessionsCompleted < 14) return 'warming';
  return 'mature';
}
```

The session count is the **user's lifetime completed-session count**, not weekly. Reset only on full account wipe.

## Regime details

### Cold (sessions 0–4)

- Pure cold-start formula from `timer.md`. No ML.
- Conservative session recommendations.
- Stats screen: forecast graph **hidden**. Replaced with "We're still learning your rhythm" badge.
- Streak counter visible from day 1.
- Beat-self target hidden.

### Warming (sessions 5–13)

- Blend cold formula + behavioral averages (see `timer.md`).
- Onboarding weight decays linearly over the first 14 days.
- Stats screen: forecast graph **appears at session 7**, with visibly wide confidence bands. Caption: "Forecast confidence: low".
- Beat-self target shown as a soft suggestion.

### Mature (sessions 14+)

- TFLite model active (`mobile/assets/models/floq-timer-v{N}.tflite`).
- Onboarding fully diluted.
- Stats screen: full UI fidelity. Tight confidence bands. Caption: "Forecast confidence: high".
- Beat-self target enabled.
- Mid-session adaptation **post-MVP** — do not implement in v0.

## Performance forecast (Model B — separate from the timer model)

The forecast model predicts the next 7 days of expected focus score. It is gated separately from the timer regime:

| Sessions | Forecast UI |
|---|---|
| 0–6 | Hidden. Stats screen shows past sessions + onboarding-progress badge. |
| 7–13 | Visible, wide bands. "Forecast confidence: low". |
| 14+ | Tight bands. Beat-self target enabled. "Forecast confidence: high". |

MVP implementation: **EWMA (exponential weighted moving average) over historical `focus_score`**. Returns next-7-day prediction + trend. Do not ship an LSTM in v0 — see post-MVP in the blueprint.

## UI implications cheat sheet

| Element | Cold | Warming | Mature |
|---|---|---|---|
| Streak counter | Visible | Visible | Visible |
| Past sessions list | Visible | Visible | Visible |
| Forecast graph | Hidden | Visible, wide bands | Visible, tight bands |
| Beat-self target | Hidden | Soft suggestion | Enabled |
| "Learning your rhythm" badge | Shown | Hidden | Hidden |
| Mid-session adaptation | — | — | Post-MVP only |

## Task NLP (one-shot LLM call, separate from regimes)

The only external API surface in the app. Free tier (Anthropic or OpenAI — see `decisions.md`). Called once per brain-dump.

- **Request:** user's free-form text describing what they need to do.
- **Prompt:** instructs strict JSON output: `{ tasks: [{ title, est_minutes, difficulty }] }`.
- **Response validation:** zod schema. On parse failure, fall back to manual entry.
- **Fallback:** manual structured task form (text + duration picker + difficulty buttons).
- **Caching:** cache by SHA-256 hash of `(input_text + user.Q4_use_case)`. Re-entering the same dump must not re-bill.
- **Rate-limit handling:** on 429, surface a friendly "let's add this manually" message and open the manual entry form pre-filled with the user's text.
