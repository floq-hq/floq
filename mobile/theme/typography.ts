/**
 * Type scale from `shared/spec/design-system.md`.
 *
 * Font family: the spec ships Inter (400/500/600 only). The font files are
 * loaded in a later task — until then we set `fontWeight` only and text renders
 * in the system font at the correct weight. When Inter is bundled, set
 * `INTER_FAMILY` per weight; nothing else here needs to change.
 *
 * Line height: 1.2× for display/title, 1.35× for everything else.
 * Letter spacing: −0.5 on display/title, 0 elsewhere. The +0.5 on uppercase
 * labels (phase pill) is applied by the component, not baked into the scale.
 */
import type { TextStyle } from 'react-native';
import type { Theme } from './tokens';

export type TypographyToken =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyMedium'
  | 'label'
  | 'caption'
  | 'tiny';

type ScaleEntry = {
  fontSize: number;
  fontWeight: TextStyle['fontWeight'];
  lineHeightRatio: number;
  letterSpacing: number;
  tabularNums?: boolean;
};

export const typographyScale: Record<TypographyToken, ScaleEntry> = {
  display: { fontSize: 56, fontWeight: '500', lineHeightRatio: 1.2, letterSpacing: -0.5, tabularNums: true },
  title: { fontSize: 28, fontWeight: '600', lineHeightRatio: 1.2, letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: '600', lineHeightRatio: 1.35, letterSpacing: 0 },
  body: { fontSize: 16, fontWeight: '400', lineHeightRatio: 1.35, letterSpacing: 0 },
  bodyMedium: { fontSize: 16, fontWeight: '500', lineHeightRatio: 1.35, letterSpacing: 0 },
  label: { fontSize: 14, fontWeight: '500', lineHeightRatio: 1.35, letterSpacing: 0 },
  caption: { fontSize: 13, fontWeight: '400', lineHeightRatio: 1.35, letterSpacing: 0 },
  tiny: { fontSize: 11, fontWeight: '500', lineHeightRatio: 1.35, letterSpacing: 0 },
};

/**
 * Returns a ready-to-spread `TextStyle` for a type-scale token. Defaults the
 * color to `theme.text`; callers override `color` for muted/accent text.
 */
export function getTextStyle(token: TypographyToken, theme: Theme): TextStyle {
  const entry = typographyScale[token];
  const style: TextStyle = {
    fontSize: entry.fontSize,
    fontWeight: entry.fontWeight,
    lineHeight: Math.round(entry.fontSize * entry.lineHeightRatio),
    letterSpacing: entry.letterSpacing,
    color: theme.text,
  };
  if (entry.tabularNums) {
    // Tabular figures keep the session timer's digits from jittering as it ticks.
    style.fontVariant = ['tabular-nums'];
  }
  return style;
}
