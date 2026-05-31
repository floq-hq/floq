---
name: ota-ship
description: Use this skill whenever the user asks to ship, release, push, or deploy a Floq change — to decide OTA-update vs native rebuild, run an EAS update, prep an iOS TestFlight build, or reason about runtimeVersion / channels. Triggers include "ship", "release", "deploy", "OTA", "eas update", "eas build", "TestFlight", "runtimeVersion", "channel", "hotfix", "push to prod", or any question about whether a change needs a rebuild. Do NOT use for writing the feature itself — only for shipping it.
---

# Floq shipping — OTA update vs native rebuild

Floq ships via EAS. `runtimeVersion.policy = "appVersion"` (app.json); channels `development` / `preview` / `production` (eas.json). The first job is always to **classify the change**.

## Step 1 — Classify: OTA-safe or native rebuild?

**OTA-safe** (ship with `eas update`, no rebuild) — the change is **pure JS/TS** and touches none of:
- a new/changed **native dependency** (anything with native code / a config plugin),
- a native **app.json** field (permissions, capabilities, entitlements, `version`, icons/**splash**, plugins),
- a native **permission** or **capability**.

Most work under `services/`, `components/`, `app/`, `theme/` is OTA-safe. Tag the decision/PR **"OTA-safe"** the way decisions L26/L27 do.

**Native rebuild** (full `eas build` + TestFlight) — anything in the list above (the **splash screen** config in app.json is native → rebuild). Critically: bumping the app `version` bumps **runtimeVersion**, and **OTA updates only reach matching runtimeVersions** — older builds are stranded until the user updates through the App Store. `docs/dogfooding.md` records the precedent: the Apple-Sign-In build moved runtime 1.0.0 → 1.1.0 and froze the 1.0.0 builds.

## Step 2 — Prep (you do this), then HAND OFF the command

Per the user's workflow, Mohamed runs the actual `eas build` / `eas update`. You do the prep and hand him the exact command:
1. `node_modules/.bin/tsc --noEmit` passes (or `pnpm typecheck`).
2. `node_modules/.bin/vitest run` passes.
3. Classify per Step 1; state OTA vs rebuild explicitly.
4. Write the exact command (below). Do not run a `build` yourself; `eas update` for an explicitly-requested OTA is fine.

## OTA update command

```bash
cd mobile
eas update --branch production --environment production --message "<concise change summary>" --non-interactive
```
Reaches only devices on the current runtimeVersion's matching channel. For a beta-only push use `--branch preview`.

## iOS production build (native changes only) — the Apple-capability footgun

The iOS provisioning profile for the app is **managed MANUALLY** (decisions L24). EAS's automatic capability sync **disables "Sign in with Apple"** during a build, producing a profile without the entitlement and failing signing.

```bash
cd mobile
eas build -p ios --profile production
#  "Do you want to log in to your Apple account?"  →  No   ← REQUIRED
```
- Answering **No** makes EAS use the stored profile as-is and skip the capability sync.
- **Never** use `--non-interactive` on the iOS production build (a cached Apple session can re-sync and re-disable the capability).
- Full recovery steps (re-enable capability, re-upload profile via `eas credentials`) live in `docs/dogfooding.md`.

## Ask before

- Bumping the app `version` (strands existing OTA users until App Store update).
- Shipping a native change (splash, icon, permission, native dep) as if it were OTA — it won't reach users.
- Running any `eas build` yourself — prep and hand the command to Mohamed.
