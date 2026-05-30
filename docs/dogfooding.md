# Dogfooding Floq on a real iPhone

Two ways to run Floq on your phone. Pick based on what you're doing.

| | Dev client + Metro | TestFlight (EAS) |
|---|---|---|
| Untethered (no laptop)? | No — needs Metro running | **Yes** |
| Best for | Active feature work, instant reload | Daily real use + the W8 ship |
| Cost / prereqs | Already set up | Apple Developer Program ($99 — **done**) |

`eas.json` (build profiles) is committed. Bundle id: `com.floq.app`. The
`production` profile builds for TestFlight; `development`/`preview` are internal
(ad-hoc) builds.

---

## Path A — Dev client + Metro (active development)

No rebuild needed unless native modules change.

```bash
cd mobile
npx expo start --dev-client     # open on the dev client already on your phone
```

Rebuild the dev client only after adding/removing a native module (per the
ios-device-build-workflow note): build, then `rm -rf ios` if you used a local
prebuild. For EAS: `eas build -p ios --profile development` and install it once.

---

## Path B — TestFlight (daily dogfooding, recommended)

### One-time setup (you run these — interactive Apple/Expo login)

1. **Install the CLI + log in to Expo** (free EAS account):
   ```bash
   npm i -g eas-cli        # or use `npx eas-cli@latest ...` everywhere
   eas login
   ```
2. **Link the project** (creates the EAS project id, writes it into app.json):
   ```bash
   cd mobile
   eas init
   ```
3. **Set the client env vars as EAS secrets** — ⚠️ critical. The app reads
   `EXPO_PUBLIC_FIREBASE_*` and the LLM keys at *build time*. They live in a
   gitignored local env, so EAS's servers don't have them unless you push them up,
   or the build ships with undefined Firebase config (app can't sign in / reach
   Firestore). Set each one:
   ```bash
   eas env:create --environment production --name EXPO_PUBLIC_FIREBASE_API_KEY --value "..."
   # repeat for every EXPO_PUBLIC_FIREBASE_* var in your local env + the LLM keys
   # (EXPO_PUBLIC_GEMINI_API_KEY, EXPO_PUBLIC_GROQ_API_KEY — decisions.md L12)
   ```
   `eas env:list --environment production` to verify.

### Each build → TestFlight

```bash
cd mobile
eas build -p ios --profile production
```
- First run prompts for your **Apple ID**; EAS auto-creates the distribution
  certificate, the provisioning profile, and registers `com.floq.app` on the
  developer portal. Let it manage credentials.
- ~15–25 min on EAS's servers. `autoIncrement` bumps the build number each time.

```bash
eas submit -p ios --latest
```
- Uploads the build to App Store Connect → TestFlight. Auto-creates the App Store
  Connect app record on first submit if it doesn't exist.
- In App Store Connect → TestFlight, add yourself (and testers) to **Internal
  Testing** (no Apple review wait for internal testers). Install via the
  **TestFlight** app on your phone.

> W8 note (S8.3): for the beta, recruit testers **as pairs** (decisions.md L18) —
> the W8 read is pair-vs-solo retention, so cohort shape matters.

---

## Now-unblocked by the $99 membership (separate task)

**Apple Sign-In** was deferred in `decisions.md` L13 until the membership was
active. It's now buildable but NOT done yet — it needs: install
`expo-apple-authentication`, add `ios.usesAppleSignIn: true` to app.json, add Apple
as a Firebase auth provider, and implement the commented-out flow in
`services/firebase/auth.ts`. Track separately; not required for a TestFlight build.
