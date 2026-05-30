// Pure initials helper for Avatar — kept in its own RN-free module so it unit-
// tests in plain Node (the .tsx imports react-native, which the test env can't
// transform; same split as forecastUiState.ts etc.).

/** Up to two initials from a display name:
 *   "Mohamed Hiba" → "MH" · "Mohamed" → "M" · "  " / "" → "?".
 *  First + last token (skips middle names); upper-cased. */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
