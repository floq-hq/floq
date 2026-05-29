// LLM task-parser orchestrator (M2.3).
//
// Public entry the brain-dump UI (S2.4) calls. Cache-first, then walks the
// locked provider chain (skipping unconfigured providers), validates every
// response with zod, caches the first valid result, and returns a typed failure
// otherwise so the UI can fall back to manual entry.

import { buildSystemPrompt } from './prompts';
import { getCachedTasks, llmCacheKey, setCachedTasks } from './cache';
import { PROVIDER_CHAIN, apiKeyFor, callProvider } from './provider';
import { ParsedTasksSchema } from './types';
import type { ParsedTask, ParseFailReason, ParseResult, UseCase } from './types';

/** JSON.parse + zod a provider's raw text into tasks; null on any failure. */
function validateTasks(text: string): ParsedTask[] | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  // Accept a bare array or the documented { tasks: [...] } wrapper. Guard the
  // property access: a provider returning literal `null` (or any non-object)
  // must not throw here — it has to flow through safeParse to a null result so
  // the UI falls back to manual entry (never let a bad response crash the path).
  const arr = Array.isArray(json)
    ? json
    : json && typeof json === 'object'
      ? (json as { tasks?: unknown }).tasks
      : null;
  const result = ParsedTasksSchema.safeParse(arr);
  return result.success ? result.data : null;
}

export async function parseTasks(
  rawInput: string,
  useCase: UseCase,
): Promise<ParseResult> {
  const input = rawInput.trim();
  if (!input) return { ok: false, reason: 'parse_failed' };

  const cacheKey = llmCacheKey(input, useCase);
  const cached = getCachedTasks(cacheKey);
  if (cached) return { ok: true, tasks: cached, cached: true };

  const systemPrompt = buildSystemPrompt(useCase);
  let lastReason: ParseFailReason = 'unavailable';

  for (const config of PROVIDER_CHAIN) {
    if (!apiKeyFor(config.id)) continue; // unconfigured (beta: Gemini only)

    const res = await callProvider(config, systemPrompt, input);
    if (!res.ok) {
      lastReason = res.reason === 'rate_limited' ? 'rate_limited' : 'unavailable';
      continue; // fall through to the next provider in the chain
    }

    const tasks = validateTasks(res.text);
    if (!tasks) {
      lastReason = 'parse_failed';
      continue;
    }

    setCachedTasks(cacheKey, tasks);
    return { ok: true, tasks, cached: false };
  }

  return { ok: false, reason: lastReason };
}
