/**
 * Wordmark — the "floq" logo lockup for in-app headers. Uses the real PNG so the
 * "oq" ligature (the brand's focus-ring mark) renders correctly, switching by
 * theme: black "fl" on light, white "fl" on dark; teal "oq" in both.
 *
 *   assets/word mix.png       — light theme (black "fl")
 *   assets/word mix dark.png  — dark theme (white "fl")
 */
import { memo } from 'react';
import { Image } from 'react-native';

import { darkTheme, useTheme } from '../../theme';

// Both PNGs share this aspect ratio (1912×1132 ≈ 478×283).
const RATIO = 1912 / 1132;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LIGHT = require('../../assets/word-mix.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DARK = require('../../assets/word-mix-dark.png');

function WordmarkBase({ height = 40 }: { height?: number }) {
  const theme = useTheme();
  const isDark = theme.bg === darkTheme.bg;
  return (
    <Image
      source={isDark ? DARK : LIGHT}
      style={{ height, width: height * RATIO }}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="floq"
    />
  );
}

export const Wordmark = memo(WordmarkBase);
