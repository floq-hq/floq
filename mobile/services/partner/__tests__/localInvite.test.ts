import { describe, it, expect, vi } from 'vitest';

// localInvite touches MMKV at module load; mock it so the pure helpers import.
vi.mock('react-native-mmkv', () => ({ createMMKV: () => ({ set: () => {}, getString: () => undefined, remove: () => {} }) }));

import { inviteLink, inviteShareMessage } from '../localInvite';

describe('inviteLink', () => {
  it('builds the pre-fill deep link from the code', () => {
    expect(inviteLink('ABCDEF')).toBe('floq://pair?code=ABCDEF');
  });
});

describe('inviteShareMessage', () => {
  it('carries the code (the real carrier) and the link', () => {
    const msg = inviteShareMessage('ABCDEF');
    expect(msg).toContain('ABCDEF');
    expect(msg).toContain('floq://pair?code=ABCDEF');
    expect(msg).toContain('Floq');
  });
});
