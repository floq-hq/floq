/**
 * Semantic color tokens for Floq. Values are frozen — copied verbatim from
 * `shared/spec/design-system.md`. Components reference these tokens (e.g.
 * `theme.accent`), never raw hex, so one component renders in both themes.
 *
 * `Theme` is derived from `lightTheme` (`typeof`), which forces `darkTheme` to
 * define every key — the two themes can never drift out of sync.
 */

export const lightTheme = {
  bg: '#FAFAFA',
  bgElevated: '#FFFFFF', // exception: elevated white on near-white bg reads correctly
  bgPressed: '#F0F0F0',
  border: '#E5E5E5',
  borderStrong: '#D4D4D4',
  text: '#0F0F0F',
  textMuted: '#6B6B6B',
  textInverse: '#FFFFFF',
  accent: '#0F8B8D',
  accentMuted: '#0F8B8D1A', // 10% alpha
  success: '#2E7D5B',
  danger: '#B94A4A',
  phase: {
    struggle: '#A36B4E', // warm clay — friction, push through
    release: '#6B7A8C', // cool slate — lightening, transition
    flow: '#0F8B8D', // brand teal — the reward
    recovery: '#7BA591', // desaturated sage — soft, parasympathetic
  },
};

export type Theme = typeof lightTheme;

export const darkTheme: Theme = {
  bg: '#0F0F0F',
  bgElevated: '#1A1A1A',
  bgPressed: '#252525',
  border: '#2A2A2A',
  borderStrong: '#3A3A3A',
  text: '#F5F5F5',
  textMuted: '#9A9A9A',
  textInverse: '#FFFFFF',
  accent: '#0F8B8D', // same hue in both modes — brand identity is non-negotiable
  accentMuted: '#0F8B8D29', // 16% alpha — slightly more present on dark
  success: '#4FAE7E',
  danger: '#E27474',
  phase: {
    struggle: '#C28466', // lifted warm clay
    release: '#8B9AAB', // lifted cool slate
    flow: '#0F8B8D', // brand teal — same hue, same identity
    recovery: '#9CBEAB', // lifted sage
  },
};
