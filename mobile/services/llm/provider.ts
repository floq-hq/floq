/**
 * LLM provider — provider-agnostic task parser (O1, locked in decisions.md L10).
 *
 * O1 is LOCKED: no single provider. `parseTasks()` walks a waterfall of
 * permanent free tiers, each backing up the next on rate-limit / error:
 *
 *   Gemini Flash (primary) -> Groq (Llama) -> OpenRouter :free -> manual entry
 *
 * OpenAI and Anthropic are intentionally absent — neither has a usable permanent
 * free tier (see L10). This file holds the LOCKED chain config + the single
 * public call site the rest of the app uses. The actual HTTP calls and zod
 * validation are implemented in M2.3 (LLM task-parser service); until then
 * `parseTasks()` throws so callers fall back to manual entry.
 *
 * ⚠️ KEY SECURITY (decide in M2.3): provider API keys must NOT ship in the
 * client bundle — they are extractable. Prefer routing through a cloud-function
 * proxy, or explicitly accept the beta risk. Do NOT use the EXPO_PUBLIC_ prefix
 * for these keys (that inlines them into the JS bundle).
 */

export type ProviderId = 'gemini' | 'groq' | 'openrouter';

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  /** Default model id. Verify against the provider's current model list in M2.3. */
  model: string;
  /** Env var holding this provider's API key (server-side — NOT EXPO_PUBLIC_). */
  apiKeyEnv: string;
}

/**
 * Locked fallback order (O1 / L10). First entry is primary; each later entry is
 * tried only if the previous one fails or is rate-limited. Ordered by free-tier
 * generosity: Gemini's ~1,500 req/day alone covers beta; the rest is insurance.
 */
export const PROVIDER_CHAIN: readonly ProviderConfig[] = [
  {
    id: 'gemini',
    label: 'Google Gemini Flash',
    model: 'gemini-2.0-flash',
    apiKeyEnv: 'GEMINI_API_KEY',
  },
  {
    id: 'groq',
    label: 'Groq Llama',
    model: 'llama-3.3-70b-versatile',
    apiKeyEnv: 'GROQ_API_KEY',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (free)',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    apiKeyEnv: 'OPENROUTER_API_KEY',
  },
] as const;

/** A single parsed task. The authoritative zod schema is defined in M2.3. */
export interface ParsedTask {
  title: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  est_minutes: number;
}

/** Thrown when every provider in the chain fails — callers fall back to manual entry. */
export class LlmUnavailableError extends Error {
  constructor(message = 'All LLM providers unavailable — fall back to manual entry.') {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}

/**
 * Provider-agnostic task parser — the single public call site for the app (per
 * the O1 note: one `parseTasks(input)` function).
 *
 * M2.3 implements: for each provider in `PROVIDER_CHAIN`, check `llm_cache`,
 * call the provider with the brain-dump prompt, validate the response with zod,
 * and return `ParsedTask[]`; on rate-limit / error / validation failure, fall
 * through to the next provider; if all fail, throw `LlmUnavailableError`.
 */
export async function parseTasks(_input: string): Promise<ParsedTask[]> {
  // TODO(M2.3): implement the fallback waterfall over PROVIDER_CHAIN with zod
  // validation + llm_cache lookups. Until then, signal "use manual entry".
  throw new LlmUnavailableError('parseTasks() not implemented until M2.3.');
}
