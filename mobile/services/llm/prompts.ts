// LLM system prompt (M2.3).
//
// Tuned to return STRICT JSON only — no markdown, no code fences, no prose — so
// the zod validator in parseTasks gets clean input. The onboarding use_case is
// folded in as context to calibrate effort/difficulty.

import type { UseCase } from './types';

const USE_CASE_CONTEXT: Record<UseCase, string> = {
  studying: 'studying / academic work',
  work: 'general knowledge / office work',
  creative: 'creative work (writing, design, music)',
  coding: 'software development',
};

export function buildSystemPrompt(useCase: UseCase): string {
  return [
    "You convert a user's raw brain-dump into a structured task list for a deep-work focus app.",
    `The user's primary context is ${USE_CASE_CONTEXT[useCase]}; use it to judge realistic effort and difficulty.`,
    '',
    'Rules:',
    '- Split the input into distinct, actionable tasks. Merge trivial fragments. Do not invent tasks the user did not imply.',
    '- "title": short and imperative (max ~200 chars).',
    '- "estMinutes": a realistic focused-work estimate, whole minutes.',
    '- "difficulty": an integer 1-5 (1 = trivial/rote, 3 = moderate, 5 = very demanding).',
    '',
    'Output: respond with ONLY a JSON object of the form',
    '{"tasks": [{"title": string, "estMinutes": integer, "difficulty": integer 1-5}]}.',
    'No markdown, no code fences, no commentary, no text before or after. JSON only.',
  ].join('\n');
}
