// LLM task-parser types (M2.3).
//
// The zod schema is authoritative: every provider response is validated against
// it before reaching the app (CLAUDE.md — never let unvalidated JSON reach the
// UI). On validation failure the service returns a typed failure so callers fall
// back to manual entry.

import { z } from 'zod';
import type { UseCase } from '../onboarding';

export type { UseCase };

/** One parsed task. difficulty is the 1–5 scale shared with the timer. */
export const ParsedTaskSchema = z.object({
  title: z.string().min(1).max(200),
  estMinutes: z.number().int().positive().max(600),
  difficulty: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
});

export type ParsedTask = z.infer<typeof ParsedTaskSchema>;

/** A brain-dump parses to at least one task. */
export const ParsedTasksSchema = z.array(ParsedTaskSchema).min(1);

export type ParseFailReason = 'parse_failed' | 'rate_limited' | 'unavailable';

/** parseTasks result. On failure the UI shows the manual-entry form. */
export type ParseResult =
  | { ok: true; tasks: ParsedTask[]; cached: boolean }
  | { ok: false; reason: ParseFailReason };
