# shared/spec/

The single source of truth for Floq's product spec. Frozen. Reference these files via `@shared/spec/<filename>.md` when working with Claude Code — do not re-derive from memory.

## Files

| File | What it covers |
|---|---|
| `timer.md` | Cold-start formula, warming blend, focus score, phases. The brain of the app. |
| `ml-regimes.md` | The cold / warming / mature router. UI implications per regime. LLM task NLP. |
| `onboarding.md` | Q1–Q4 seed questions. First-session framing card content. |
| `session-flow.md` | End-to-end user journey, behavioral rules, streak definition, background policy. |
| `science.md` | Citations for every constant. **Updating a constant requires updating this file.** |
| `decisions.md` | Locked + open architectural decisions. Read before doing anything ambiguous. |
| `design-system.md` | Typography, color tokens, themes, phase colors, implementation rules |
| `tasks.md` | Week-by-week task breakdown for Mohamed and Mustafa, with dependencies and acceptance criteria |

## How to use this folder

- **Adding to the spec:** open a PR. Mention the new section in `decisions.md` if it has architectural implications.
- **Conflicting with the spec:** stop and write a new entry in `decisions.md`. Never silently diverge.
- **Asking Claude to do something timer-related:** reference `@shared/spec/timer.md` in your prompt. The `floq-timer` skill auto-loads but the explicit reference is a useful belt-and-braces.

## Order to read if you're new

1. `decisions.md` — what's locked, what's open.
2. `science.md` — why the constants are what they are.
3. `timer.md` — the formula.
4. `ml-regimes.md` — the router.
5. `session-flow.md` — the user journey.
6. `onboarding.md` — the seed.
