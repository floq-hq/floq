import { describe, it, expect, vi } from 'vitest';

// Mock the native/side-effecting boundaries so the pure helpers import in node.
vi.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getBoolean: () => undefined, getNumber: () => undefined, set: () => {} }) }));
vi.mock('../../notifications', () => ({ ensurePermission: vi.fn(() => Promise.resolve(true)) }));
vi.mock('../../firebase', () => ({ db: {}, setShareConsent: vi.fn(), useCurrentUser: () => ({ user: null }) }));

import { readMyConsent } from '../useShareConsent';
import { decideSocialNotifPrompt, type SocialNotifState } from '../notifSocialPrompt';

describe('readMyConsent', () => {
  it('is true only when my bit is explicitly true (default-OFF)', () => {
    expect(readMyConsent({ me: true }, 'me')).toBe(true);
    expect(readMyConsent({ me: false }, 'me')).toBe(false);
    expect(readMyConsent({ them: true }, 'me')).toBe(false); // partner's bit, not mine
    expect(readMyConsent({}, 'me')).toBe(false);
    expect(readMyConsent(undefined, 'me')).toBe(false);
    expect(readMyConsent(null, 'me')).toBe(false);
  });
});

describe('decideSocialNotifPrompt', () => {
  const fresh: SocialNotifState = { asked: false, sessionEnds: 0 };

  it('a reaction asks immediately and marks asked', () => {
    const d = decideSocialNotifPrompt(fresh, 'reaction');
    expect(d.ask).toBe(true);
    expect(d.next.asked).toBe(true);
  });

  it('first session-end counts but does NOT ask; second does', () => {
    const first = decideSocialNotifPrompt(fresh, 'session-end');
    expect(first.ask).toBe(false);
    expect(first.next).toEqual({ asked: false, sessionEnds: 1 });

    const second = decideSocialNotifPrompt(first.next, 'session-end');
    expect(second.ask).toBe(true);
    expect(second.next.asked).toBe(true);
  });

  it('never asks twice (idempotent once asked)', () => {
    const asked: SocialNotifState = { asked: true, sessionEnds: 5 };
    expect(decideSocialNotifPrompt(asked, 'reaction').ask).toBe(false);
    expect(decideSocialNotifPrompt(asked, 'session-end').ask).toBe(false);
  });
});
