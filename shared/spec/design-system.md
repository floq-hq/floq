# shared/spec/design-system.md

The visual language for Floq. Frozen once locked here — same discipline as `timer.md` and `science.md`. The product tone is **calm, scientific, anti-gamified** — closer to a quiet operating system than a motivational productivity app. Every choice in this file ladders up to that.

## Tone in one line

> Floq is what a focus app looks like when it respects you and trusts the science.

If a design decision would make Floq feel "motivational," "playful," "exciting," or "gamified," it is wrong.

---

## Typography

### Wordmark (logo only)

**Typeface:** General Sans (free, Fontshare).
**Usage:** the `floq` wordmark and the standalone `oq` ligature mark only. Not used in the app UI.
**Rationale:** more personality and geometric balance than Inter while still feeling rational. The `oq` ligature with shared circular geometry reads as eye / focus ring / connected loop — strong brand asset.

### App UI

**Typeface:** Inter (free, Google Fonts / Fontshare).
**Weights shipped:** 400 Regular, 500 Medium, 600 Semibold. **Do not ship Bold (700) or heavier.**
**Rationale:** Best-in-class readability on mobile at small sizes. Calm visual weight even at 600.

### Type scale

| Token | Size | Weight | Use |
|---|---|---|---|
| `display` | 56 | 500 | The session timer (`42:18`) |
| `title` | 28 | 600 | Hero numbers on Stats screen, screen titles |
| `heading` | 20 | 600 | Card titles, section headers |
| `body` | 16 | 400 | Default text |
| `bodyMedium` | 16 | 500 | Emphasized inline text |
| `label` | 14 | 500 | Pills, badges, labels |
| `caption` | 13 | 400 | Hints, secondary info |
| `tiny` | 11 | 500 | Phase pill, status indicators |

Line height = 1.35 × size for body, 1.2 × size for display/title.
Letter spacing: 0 default. `-0.5` on display/title. `+0.5` on uppercase labels.

### Hard rules

- No heavy bold (700+).
- No oversized type. Display size 56 is the largest in the app.
- No decorative or rounded display fonts.
- Numerals: use Inter's tabular figures (`fontVariant: ['tabular-nums']`) for the session timer so digits don't jitter as they tick.

---

## Color philosophy

Two findings from the research (full citations in `shared/spec/science.md` if migrated; key sources: Buchner & Baumgartner 2007, Piepenbrock et al. 2013/2014, Nielsen Norman Group, Sengsoon & Intaruk 2025):

1. **Light mode wins on raw reading performance** (positive-polarity advantage — better proofreading, comprehension, acuity).
2. **Users overwhelmingly *prefer* dark mode** (~78–82% across multiple 2025 surveys), and report less eye strain on long sessions.

Floq's response: **ship both, follow the system, let the user override.** The session screen is not a reading task — total text on screen during a focus session is well under 30 words — so the performance gap doesn't translate strongly. The environment-comfort gap does.

### Hard rules

- **No pure black (`#000000`).** Pure black on OLED produces uncomfortable contrast against text and aggravates astigmatism. Use `#0F0F0F`.
- **No pure white (`#FFFFFF`).** Same reason in reverse — glare in dim environments. Use `#FAFAFA`.
- **No neon.** No `#00FFFF`-style saturation anywhere.
- **No gradients, no glassmorphism, no shadows beyond a single subtle elevation, no 3D, no skeuomorphic anything.**
- **Contrast minimums:** body text ≥ 4.5:1, large text (≥18px or ≥14px bold) ≥ 3:1. WCAG AA. Check with a contrast checker — don't eyeball.
- **The teal accent must remain identifiable in both themes** without changing hue. Same `#0F8B8D` in both modes.

---

## Token system

Tokens are **semantic**, not literal. A component never references `#0F8B8D` directly — it references `theme.accent`. This is what lets one component file render correctly in both themes.

### Semantic tokens (both themes define every key)

| Token | Role |
|---|---|
| `bg` | Default screen background |
| `bgElevated` | Cards, modals, elevated surfaces |
| `bgPressed` | Pressed-state background for tappable surfaces |
| `border` | Subtle divider / card outline |
| `borderStrong` | Emphasized divider |
| `text` | Default body text |
| `textMuted` | Secondary text (hints, captions) |
| `textInverse` | Text that sits on `accent` (always high-contrast white) |
| `accent` | Brand teal. Primary CTA, active states, links |
| `accentMuted` | Translucent teal for backgrounds, soft highlights |
| `success` | Positive feedback (rare — no checkmark cliché) |
| `danger` | Distraction-logged flash, destructive actions |
| `phase.struggle` | Phase indicator color, Struggle |
| `phase.release` | Phase indicator color, Release |
| `phase.flow` | Phase indicator color, Flow |
| `phase.recovery` | Phase indicator color, Recovery |

### Light theme

```ts
{
  bg:           '#FAFAFA',
  bgElevated:   '#FFFFFF',     // exception: elevated white on near-white bg reads correctly
  bgPressed:    '#F0F0F0',
  border:       '#E5E5E5',
  borderStrong: '#D4D4D4',
  text:         '#0F0F0F',
  textMuted:    '#6B6B6B',
  textInverse:  '#FFFFFF',
  accent:       '#0F8B8D',
  accentMuted:  '#0F8B8D1A',    // 10% alpha for backgrounds
  success:      '#2E7D5B',
  danger:       '#B94A4A',
  phase: {
    struggle:   '#A36B4E',      // warm clay — friction, push through
    release:    '#6B7A8C',      // cool slate — lightening, transition
    flow:       '#0F8B8D',      // brand teal — the reward
    recovery:   '#7BA591',      // desaturated sage — soft, parasympathetic
  }
}
```

### Dark theme

```ts
{
  bg:           '#0F0F0F',
  bgElevated:   '#1A1A1A',
  bgPressed:    '#252525',
  border:       '#2A2A2A',
  borderStrong: '#3A3A3A',
  text:         '#F5F5F5',
  textMuted:    '#9A9A9A',
  textInverse:  '#FFFFFF',
  accent:       '#0F8B8D',
  accentMuted:  '#0F8B8D29',    // 16% alpha — slightly more present on dark
  success:      '#4FAE7E',
  danger:       '#E27474',
  phase: {
    struggle:   '#C28466',      // lifted warm clay
    release:    '#8B9AAB',      // lifted cool slate
    flow:       '#0F8B8D',      // brand teal — same hue, same identity
    recovery:   '#9CBEAB',      // lifted sage
  }
}
```

### Why phase colors lift in dark mode (and accent doesn't)

The accent is the brand — same hue across modes is non-negotiable. `#0F8B8D` reads correctly on both `#FAFAFA` and `#0F0F0F` (contrast ≥ 3:1 against both, ≥ 4.5:1 if used as text on `bgElevated`).

Phase colors aren't brand — they're functional. On a dark background, the same muted clay/slate/sage that works on light becomes nearly indistinguishable from `border` and `textMuted`. Lifting their luminance by ~15% preserves the *feeling* of the color while keeping perceptual contrast equivalent. The Flow color is the only phase that stays identical because it's also the brand accent.

---

## Theme behavior

**Default:** follow system. Expo's `userInterfaceStyle: "automatic"` in `app.json` plus `useColorScheme()` from `react-native`.

**Override:** Settings screen has a three-way selector: System / Light / Dark.

**Persistence:** the override is stored in MMKV under key `floq.theme_override`. Values: `'system' | 'light' | 'dark'`. Default `'system'`.

**Boot order:**
1. Read MMKV `floq.theme_override` synchronously on app start (MMKV is sync — no flash).
2. If `'system'`, use `useColorScheme()` and follow OS changes live.
3. If `'light'` or `'dark'`, use that and ignore `useColorScheme()`.

**No flash of wrong theme.** MMKV reads are synchronous; the first render must already have the correct theme. Do not use AsyncStorage for this — it's async and will flash.

---

## Implementation

### File layout

```
mobile/theme/
  index.ts              re-exports useTheme(), ThemeProvider
  tokens.ts             the two token sets above, typed
  ThemeContext.tsx      provider + override store
  useTheme.ts           hook that returns the active token set
  typography.ts         the type scale + helper getTextStyle()
mobile/components/ui/
  ... uses useTheme() exclusively, never raw hex
```

### Component pattern

```ts
// good
const theme = useTheme();
<View style={{ backgroundColor: theme.bg }}>
  <Text style={{ color: theme.text }}>Hello</Text>
</View>

// bad
<View style={{ backgroundColor: '#FAFAFA' }} />
<View style={{ backgroundColor: useColorScheme() === 'dark' ? '#0F0F0F' : '#FAFAFA' }} />
```

The second bad example is worse than the first — it duplicates theme logic everywhere it appears.

### Status bar

Light theme → dark status bar icons. Dark theme → light status bar icons. Use `expo-status-bar` with `style="auto"` to get this for free.

### No NativeWind, no styled-components

Per `mobile/CLAUDE.md`. Plain StyleSheet + the `useTheme()` hook. No further styling abstractions.

---

## Visual language rules

### Do

- Rounded corners — `8` for cards/buttons, `12` for sheets, `16` for the timer pill, `9999` (full pill) for the phase indicator.
- Soft geometry. Circles, pills, gentle rectangles.
- Restrained whitespace. The session screen has more empty space than content. That's the point.
- Low-noise UI. Single accent color (teal). Single text color per theme. Most surfaces are `bg` or `bgElevated`, nothing else.
- Flat colors. One subtle 1px border on cards is the maximum "lift" allowed.
- Inter at the weights specified, nothing else.

### Don't

- Neon. Saturated `accent` is `#0F8B8D` — already restrained. Do not push it brighter.
- Gamification visuals. No badges, no "level up" graphics, no streaks-on-fire icons, no confetti.
- Glassmorphism / frosted blur backgrounds.
- Gradients. Anywhere. Solid colors only.
- Hard shadows. One soft elevation shadow at most (`shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }`), and only for floating elements like modals.
- Sharp corners (radius 0–4 is too sharp for our language; 6 minimum).
- Productivity-cliché checkmark icons for streaks or completed sessions. Use restrained typography.
- Emoji as UI elements.

---

## Phase indicator — design rules

The phase pill on the session screen is the single most distinctive piece of UI in Floq. It deserves its own constraints.

- Always full-pill rounded (`borderRadius: 9999`).
- Background: the active phase color at 12% alpha. Text: the active phase color at full opacity.
- Text: `tiny` size (11), weight 500, **uppercase**, letter-spacing +0.5.
- Animates color shifts over 800ms with `easeInOut` when the phase changes. No flashing, no bouncing.
- Position: top of the session screen, horizontally centered.

```
┌─────────────────────────┐
│    ●  STRUGGLE          │   ← muted clay bg, clay text, small dot in same color
└─────────────────────────┘
```

The dot is the same color as the text. Diameter ~6px. It's a presence marker, not a status light — do not add pulsing animation.

---

## App icon

Both variants ship — iOS supports light and dark app icons natively in 2026.

- **Light icon:** teal (`#0F8B8D`) rounded square, white `oq` ligature centered.
- **Dark icon:** off-black (`#0F0F0F`) rounded square, teal (`#0F8B8D`) `oq` ligature centered.
- Both use the same `oq` ligature shape — no tweaks per variant.
- No gradient, no shadow, no inner glow, no bezel. The corner radius is whatever iOS applies automatically (do not pre-round).

---

## Open questions

Nothing in this spec is open. If you find an open question while implementing, add it to `shared/spec/decisions.md` rather than guessing.
