# Floq W7 — The Social Layer, on one page

*Distilled 2026-06-01 from the adversarial-workflow draft (`w7-social-plan-draft.md`, v14). Mohamed at full capacity — Egypt changes nothing.*

## The thesis (what W7 is for)
Ship the **smallest social system that produces one clean W8 read** on the only growth lever we can both move and measure: **does the friend-pairing loop fire and spread?** Recruit users *as pairs* from Day 0 and measure the **loop mechanics** — not retention. "Do pairs retain better than solos?" is a real question, but it needs a control arm we can't run at n≈15, so it's **W9's job**, answered honestly rather than faked.

## What a session feels like
**Law: social at the boundaries, the focused middle is sacred — no notification ever fires mid-session.**
- **Before:** your partner is focusing → "join?"; or one tap "Focusing now — join me?". Each person starts their **own** ML-adaptive length (never a shared Focusmate clock).
- **During:** quiet, glanceable presence. No chat, no pings, no shared timer. Distraction button + backgrounding unchanged.
- **After:** your finish shows on your partner's next open → they tap a reaction (🔥/👏) → the session card generates, and the card *is* the invite.

## What we ship (all OTA — no native rebuild)
- **Invite-code install-and-pair** — friend types a 6-char code, lands **already paired**. (A link can't pair a fresh install; the typed code carries it. Recruiting script = "text them the code.")
- **1:1 partner edge + partner-visible summaries** — minutes / score / when. **Never task titles** (read from a stripped `social/summary`, never the raw session doc).
- **Coarse live presence** primitive (the one thing the Room later reuses).
- **One-tap reaction** on a partner's finished session.
- **Broadcast-card claim code** — the shared card carries a capped, claimable code = our single **k>1** growth probe.
- **Gentle by design:** no forward commitment, no shared clock, **no streak pressure** (streak ships dark).

**Scaffold dark:** the Room (schema only), pair-streak engine (flag off).
**Dropped:** remote push (→ local + in-app), scheduled sessions, the finish digest, any analytics SDK, a randomized control arm.

## The W8 read — two axes, kept separate
- **Axis A (THE W7 deliverable): does the loop fire?** invite→install→pair convert rate · do paired users start-together · do they react · card-claim rate. Needs **~10–16 pairs** to be readable.
- **Axis B (does pairing retain): deferred to W9** — no clean control arm at this n.
- **Decision rule:** below the pair threshold the question is *unanswered* → **slip the beta a week and keep recruiting.** Do **not** launder a thin result into "it works" *or* "kill it."

## Who builds what (both full-time)
- **M (backend):** invite/pair service + Firestore rules (the two rules the read transits — the `acceptInvite` create-gate under the Spark 10-`get()` cap, and the sorted-UID partner-read — are **Day 1–2 release gates** with emulator tests), presence primitive, projection writers, wipe completeness, **recruiting from Day 0**.
- **S (UI):** invite/pair flow, partner view, presence surface, reaction, the single pairing-consent.

## Lock Day 0 (`decisions.md`) before any code
Async → **live coarse co-presence** flip · **L2 nudge** (coarse consented presence may leave device) · reaffirm **L4** (titles never leave) · a **narrow cross-tree write-grant** so a member can end a co-owned partnership.

## Risks we carry knowingly
1. **Coupling** — pairs *might* churn faster than solos (thesis-inverting); W9's first job is to check it.
2. **No Room/liquidity signal yet** — the "low pairing → build the Room" branch rests on conviction + the one card datapoint.
3. **Single backend reviewer** — not a capacity problem (M is full-time), but no second pair of eyes on the rules → mitigated by emulator tests, not scope cuts.
4. **Reactions arrive cold** (no timely push) — the timely-reward beat is an explicit W9 spend.
