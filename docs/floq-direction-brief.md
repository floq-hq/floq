# Floq — Where We're Going, and What Changes

A brief for the team. Self-contained — you don't need any prior context to follow it. It covers two things: a **strategic direction** I want us to align on, and the **concrete product changes** already in motion that affect what we build next.

---

## 1. Where we are today

Floq is a science-based deep-work app. The core is an **adaptive focus timer** — instead of a fixed Pomodoro 25/5, it computes a personalized focus length from your context (task difficulty, time of day, fatigue, your history) using **on-device machine learning**, and it has an **async social layer** (Whoop-style metrics you can share with friends).

We're **mid-Week 4 of an 8-week build**, heading to a TestFlight beta. The timer logic, the onboarding, the task queue, distraction logging, focus score, and local persistence are built or in progress. The ML model, stats, and the social features are still ahead of us (Weeks 5–8).

This brief is about a question worth answering *now*, before we build the back half: **what is this product actually trying to become, and does the current plan get us there?**

---

## 2. The honest problem with the plan as written

If we ship exactly what's planned — a really good solo focus app with a social leaderboard bolted on — the most likely outcome is a nice product that gets a few thousand users and then plateaus. That's not a failure; it's just the ceiling of the category. Standalone focus apps (Forest, Session, Be Focused) top out as small businesses because people churn out of focus tools once the novelty fades, and a $5/month subscription with high churn doesn't compound into anything big.

The deeper reason isn't quality — it's **distribution**. The apps that get big have a built-in way to spread:
- **Virality** — using it makes you invite others.
- **Network effects** — it gets better as more people use it.
- **A wedge** — it attaches to something you already do every day.

A solo focus app has none of these. It's a "destination app" — you have to *remember* to open it, and nothing about using it brings in another user. Our on-device ML is genuinely good and it's a real moat against copycats, but a moat keeps people in; it doesn't get them in the door. It improves **retention**, not **growth**. And the social layer as currently planned (a leaderboard + a feed) is passive — you glance at it once a week. It's a feature, not an engine.

So the honest read: **the current plan builds a good product with no way to grow.**

---

## 3. The shift: make the social piece the core, not a feature

The one thing in our product that can create *both* distribution and retention is **focusing with a partner**.

I want to reorganize the product around the **focus partnership** — not "a focus app that also has friends," but "a focus partnership that the timer and ML make intelligent." You can still use it solo (that's how most people will try it), but everything is designed to pull toward pairing, because pairing is three things at once:

- **Growth:** to pair, you invite one specific person. Every active user brings in another as a *structural* property of using the product — not a marketing campaign.
- **Retention:** a partner is why you open the app on day 47, when your own streak has gotten boring. Solo apps lose people by week 3–4 because the only person who cares about your streak is you. A partner doesn't let you off the hook the same way.
- **Moat:** a pair is a relationship that's hard to leave — and "which partner is a good fit for you" is something our ML can do that a competitor built as a solo app simply can't.

This isn't a wild idea. **Focusmate** (paired focus sessions) is a profitable business. **Body-doubling** — working alongside someone for accountability — is already mainstream in productivity and ADHD communities. The behavior is proven. What's missing is a great, mobile, ML-powered consumer version of it. That's the opening.

---

## 4. The important part: we do this in two phases

There are actually **two very different versions** of "social," and conflating them is how you get this wrong:

- **Phase A — Friend-pairing.** You bring your own partner (a friend). We can build this now, it keeps our on-device/privacy technology intact, and there's no chicken-and-egg problem — *you* supply the partner. Its limit: it only reaches people whose friends also want a focus app, so it's strong but not explosive on its own.

- **Phase B — Matching.** The app pairs you with a compatible stranger (the Focusmate model). **This is the version with the huge ceiling** — anyone can pair, so it can actually grow without limit. But it's a *marketplace*: it only works if lots of people are online to match with, which is hard to bootstrap; it likely needs outside funding and skills we don't have yet; and it changes our privacy/architecture story (matching strangers means some data has to leave the device, which our on-device approach currently avoids).

**The plan: build Phase A first.** Prove that paired users actually stick around more than solo users. *Then* earn the right to Phase B — the matching, the bigger architecture, probably a raise.

I want to be straight about what this is: **it raises our ceiling a lot and our risk a lot.** It's a real bet, with a real chance of not working. But the "safe" path tops out as a small app anyway — so for two people with no outside money, swinging at something bigger is the rational move. We're trading a high chance of a small outcome for a lower chance of a large one.

---

## 5. What changes in the build

- **This week (W4):** nothing changes. We finish what's in flight — storage and the session-lifecycle work (see §7).
- **W5–W6:** mostly unchanged. The ML forecast and model work proceed as planned, plus we add the **session card** (see §6).
- **W7 — the big change, and it's mostly your area:** the planned "friends list + leaderboard + activity feed" is **replaced** by the **partnership**: an invite-a-partner flow, your partner seeing your planned and completed sessions, and a **shared streak** designed *gently* — grace periods for travel/sickness, and one person flaking shouldn't nuke the other's individual progress. The hardest and most important design problem is the **activation funnel**: getting a new user into a working partnership fast, and making the solo experience genuinely good for someone whose partner hasn't joined yet. If we get that funnel wrong, nothing else matters.
- **W8:** ship the beta to a small set of **pairs**, not individuals, and watch one thing — **do paired users retain noticeably better than solo users?** That's the entire test. If yes, we've found something. If no, we revert to a polished solo app and we've learned it cheaply.

---

## 6. The shareable artifact (ships no matter what)

Separate from pairing, we build the **session card**: a single completed focus session rendered as a beautiful, screenshot-worthy image — the phase curve, the focus score as the hero number, a one-line insight ("your Tuesday mornings run 14% above your average"), and a quiet Floq mark. Think Spotify Wrapped or a Whoop recovery screenshot — something people post because it's a cool artifact about *their own brain*, not an ad.

This is our marketing surface, and it ships in **W6** regardless of the pairing decision. It amplifies whatever growth loop exists; it's cheap insurance that's useful in every version of the plan.

---

## 7. Product decisions already locked (these affect what we build now)

Independent of the strategy above, I've locked a set of session-lifecycle decisions that change the core loop. In plain terms:

- **You can leave a session early without losing your task.** Today the only way out is "Done," which completes the task and removes it. Now there's an "end early" option that asks *Save or Discard*; either way your task stays in the queue. A saved early session still counts toward your score and streak (you did real work), it just isn't a completed task.
- **If the app is killed mid-session,** on reopening you're asked to *Resume / Save / Discard* — we don't silently lose your session.
- **Going past your suggested time is tracked as "overrun,"** and your recommended break is recalculated from how long you *actually* focused, not the original estimate.
- **Recovery (the break) is recommended, not forced.** You can skip it and start again immediately — but skipping shortens your *next* session's recommendation, because the research is clear that under-resting hurts the next bout. There's a calm one-line note explaining this, and a "time since last session" indicator.

These are written up in a spec PR. To keep them off your plate this round, **I'm taking the UI for them myself**, since they're tightly coupled to the timer/data work I own.

---

## 8. How it makes money

One rule governs everything: **the loop is free, the depth is paid.** In a social product, the thing that drives growth (free, viral pairing) fights the thing that makes money (paywalls). If we paywall the pairing mechanic, we kill the growth engine — so we never do that.

- **Free, forever:** solo timer, one focus partner, pairing + streaks, and the shareable session card. This is the acquisition + retention engine and it has to be unpaywalled.
- **Paid — "Pro," ~$70–100/year (annual-led):** the longitudinal "understand your brain over months" analytics, advanced insights/forecasting, smarter matching later, integrations (sleep/calendar), multiple partners. This is the **Strava model** — the social loop is free, the analytics are the subscription.
- **Pairing-native upsell (no solo app can do this):** if your partner has Pro, the feature gap pulls you to upgrade; and a discounted **pair plan** (like Spotify Duo) is a pricing unit that only exists because we're built around pairs.
- **The bigger money, later: teams.** "Floq for Teams" — accountability partnerships inside a company, bought from a wellness budget (the Calm-for-Business playbook). Per-seat B2B dwarfs consumer pricing. It's a different sales motion, so it comes after we have traction — but the cognitive-performance framing sets it up.
- **Frame matters:** people pay ~2–3× more for a "cognitive performance membership" than a "focus timer." We price on performance, not on the tool.
- **What we won't do:** ads (wrecks a focus brand and the calm feel), paywalling the pairing loop, or one-time purchases.

The honest caveat: freemium converts ~1–5% to paid, so this only produces real revenue **at scale** (which is exactly why the pairing/distribution loop matters) **or** from a **higher-paying segment** (executives / teams). Whichever audience we build for sets the price we can charge — so pricing and "who is this for" are the same decision.

## 9. The risks, stated plainly

- **The activation cliff:** if pairing is the core, a user with no partner has no product. Mitigated by a strong solo on-ramp now, and matching later.
- **It's a conviction bet:** we can't *prove* pairing works without building it — surveys won't tell us, only real usage will.
- **We don't have marketplace/social-scaling experience yet:** that's exactly why Phase B (matching) waits until we have evidence and resources.
- **It might just not take:** if paired users don't retain better, we revert to a polished solo app plus the session card — and we'll have learned the one thing that mattered before launch, not after.

---

## 10. What I want from you

1. **Alignment on the direction:** social-as-core, built in two phases (friend-pairing now, matching later). Are you in?
2. **Your read on the W7 partnership UX** — especially the activation funnel (how a new user gets into a working partnership, and the solo experience while they wait for a partner). This is the make-or-break, and it's your strongest area.
3. **A shared decision that this is the bet we're making** — because it changes the back half of our roadmap, and I don't want to commit to it without you.

The near-term work doesn't change either way: this week is closing out W4. But the W5–W8 plan bends toward this, so I'd like us aligned before W5 starts.
