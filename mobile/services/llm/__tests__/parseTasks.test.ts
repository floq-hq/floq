import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the native MMKV boundary (cache) and the provider HTTP seam. js-sha256
// runs for real, so the cache key is exercised end-to-end.
const { mmkvStore, callProvider } = vi.hoisted(() => ({
  mmkvStore: new Map<string, string>(),
  callProvider: vi.fn(),
}));

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (k: string) => mmkvStore.get(k),
    set: (k: string, v: string) => {
      mmkvStore.set(k, v);
    },
    remove: (k: string) => {
      mmkvStore.delete(k);
    },
  }),
}));

// Keep the real PROVIDER_CHAIN / types; replace the HTTP call and force a
// Gemini-only configuration (the beta posture from L12).
vi.mock('../provider', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../provider')>();
  return {
    ...orig,
    apiKeyFor: (id: string) => (id === 'gemini' ? 'test-key' : undefined),
    callProvider,
  };
});

import { parseTasks } from '../parseTasks';

const OK_JSON = JSON.stringify({
  tasks: [{ title: 'Write essay', estMinutes: 45, difficulty: 3 }],
});

beforeEach(() => {
  mmkvStore.clear();
  callProvider.mockReset();
});

describe('parseTasks', () => {
  it('returns validated tasks on a valid provider response', async () => {
    callProvider.mockResolvedValue({ ok: true, text: OK_JSON });
    const res = await parseTasks('write my essay', 'studying');
    expect(res).toEqual({
      ok: true,
      cached: false,
      tasks: [{ title: 'Write essay', estMinutes: 45, difficulty: 3 }],
    });
  });

  it('AC: malformed JSON → { ok: false, reason: "parse_failed" }', async () => {
    callProvider.mockResolvedValue({ ok: true, text: 'not json {' });
    expect(await parseTasks('whatever', 'work')).toEqual({
      ok: false,
      reason: 'parse_failed',
    });
  });

  it('valid JSON but wrong shape is rejected by zod → parse_failed', async () => {
    callProvider.mockResolvedValue({
      ok: true,
      text: JSON.stringify({ tasks: [{ title: 'x' }] }), // missing estMinutes/difficulty
    });
    expect(await parseTasks('whatever', 'work')).toEqual({
      ok: false,
      reason: 'parse_failed',
    });
  });

  it('AC: 429 rate-limit → { ok: false, reason: "rate_limited" }', async () => {
    callProvider.mockResolvedValue({ ok: false, reason: 'rate_limited' });
    expect(await parseTasks('whatever', 'work')).toEqual({
      ok: false,
      reason: 'rate_limited',
    });
  });

  it('AC: identical input is served from cache — provider hit only once', async () => {
    callProvider.mockResolvedValue({ ok: true, text: OK_JSON });
    const first = await parseTasks('same input', 'coding');
    const second = await parseTasks('same input', 'coding');

    expect(callProvider).toHaveBeenCalledTimes(1);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.cached).toBe(true);
      expect(second.tasks).toEqual(first.tasks);
    }
  });

  it('different useCase is a cache miss (key includes useCase)', async () => {
    callProvider.mockResolvedValue({ ok: true, text: OK_JSON });
    await parseTasks('same text', 'coding');
    await parseTasks('same text', 'work');
    expect(callProvider).toHaveBeenCalledTimes(2);
  });

  it('AC: the prompts.ts system prompt is passed to the provider', async () => {
    callProvider.mockResolvedValue({ ok: true, text: OK_JSON });
    await parseTasks('do stuff', 'creative');
    const [, systemPrompt] = callProvider.mock.calls[0];
    expect(systemPrompt).toContain('JSON');
    expect(systemPrompt).toContain('creative');
  });

  it('empty input short-circuits to parse_failed without calling a provider', async () => {
    expect(await parseTasks('   ', 'work')).toEqual({
      ok: false,
      reason: 'parse_failed',
    });
    expect(callProvider).not.toHaveBeenCalled();
  });
});
