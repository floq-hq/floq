// Partner-visible display-name sanitization (M7.1) — PURE, React/IO-free.
//
// `display_name` is user-typed FREE TEXT, editable any time. A partner reads a
// SEPARATE projected `social/profile.display_name`, never the raw field — so this
// is the boundary that caps length, strips control chars, and downgrades a name
// that's actually a phone number / URL / slur to a safe placeholder. It NEVER
// throws (a rejected name must not block a legitimate edit) and NEVER mutates the
// owner's own display_name — only what the partner sees.

const MAX_LEN = 40; // matches the sign-up schema cap (components/auth/schemas.ts)
export const SAFE_FALLBACK = 'Floq user'; // matches auth.ts's default display name

// Conservative heuristics: a false positive only downgrades a real name to the
// placeholder (annoying, safe); a false negative would leak a phone/URL (bad), so
// bias toward catching. Tunable knobs, not frozen constants.
// Control chars 0x00–0x1F and 0x7F–0x9F.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F-\\u009F]', 'g');
const PHONE_RE = /(?:\+?\d[\s().-]*){7,}/; // 7+ digits with phone-ish separators
const URL_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|io|co|app|me|ly|xyz|link)\b)/i;
// Tiny seed denylist — substring match on the letters-only normalized string.
// Intentionally small; the reactive Report path (S7.3) is the real backstop.
const SLURS = ['nigger', 'faggot', 'retard', 'kike', 'spic', 'chink', 'tranny'];

function matchesSlur(lower: string): boolean {
  const collapsed = lower.replace(/[^a-z]/g, '');
  return SLURS.some((s) => collapsed.includes(s));
}

/** Map a raw display name to a partner-safe projection value. Never throws. */
export function sanitizeDisplayNameForPartner(raw: unknown): string {
  if (typeof raw !== 'string') return SAFE_FALLBACK;

  let s = raw.replace(CONTROL_CHARS, '').trim();
  if (s.length === 0) return SAFE_FALLBACK;
  if (s.length > MAX_LEN) s = s.slice(0, MAX_LEN).trim();

  const lower = s.toLowerCase();
  if (PHONE_RE.test(s) || URL_RE.test(lower) || matchesSlur(lower)) return SAFE_FALLBACK;

  return s;
}
