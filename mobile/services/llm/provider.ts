/**
 * LLM provider chain + client-direct transport.
 *
 * O1 LOCKED (decisions.md L10): no single provider. parseTasks() walks a
 * waterfall of permanent free tiers, each backing up the next on
 * rate-limit / error:
 *
 *   Gemini Flash (primary) -> Groq (Llama) -> OpenRouter :free -> manual entry
 *
 * KEY HANDLING (decisions.md L12): client-direct for beta. Keys are read at
 * runtime from EXPO_PUBLIC_* env vars, which inlines them into the JS bundle
 * (accepted beta risk). In beta ONLY Gemini is configured; Groq/OpenRouter have
 * no key and are skipped. Move to a Cloud Function proxy + App Check before any
 * public launch.
 */

export type ProviderId = 'gemini' | 'groq' | 'openrouter';

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  /** Default model id. Verify against the provider's current model list. */
  model: string;
  /** EXPO_PUBLIC_ env var holding this provider's key (read statically below). */
  apiKeyEnv: string;
}

/**
 * Locked fallback order (O1 / L10). First is primary; each later entry is tried
 * only if the previous fails or is rate-limited. Ordered by free-tier
 * generosity for the common path: gemini-2.5-flash-lite (15 RPM / 1,000 RPD,
 * best quality, key restrictable) is primary; Groq llama-3.1-8b-instant
 * (14,400 RPD) is the overflow fallback once Gemini is rate-limited; OpenRouter
 * is the optional third link. (gemini-2.0-flash was deprecated — see model note.)
 */
export const PROVIDER_CHAIN: readonly ProviderConfig[] = [
  {
    id: 'gemini',
    // flash-lite: fastest/cheapest, highest free-tier limits, recommended for
    // classification/extraction. Bump to 'gemini-2.5-flash' if parse quality
    // is lacking (still free, but 250 RPD vs 1,000).
    label: 'Google Gemini 2.5 Flash-Lite',
    model: 'gemini-2.5-flash-lite',
    apiKeyEnv: 'EXPO_PUBLIC_GEMINI_API_KEY',
  },
  {
    id: 'groq',
    // llama-3.1-8b-instant: 14,400 RPD on Groq's free tier (14x every other Groq
    // model) — the overflow path once Gemini's 1,000 RPD is spent. Lower quality
    // than Gemini, but it only runs after a Gemini rate-limit, so that's fine.
    label: 'Groq Llama 3.1 8B Instant',
    model: 'llama-3.1-8b-instant',
    apiKeyEnv: 'EXPO_PUBLIC_GROQ_API_KEY',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (free)',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    apiKeyEnv: 'EXPO_PUBLIC_OPENROUTER_API_KEY',
  },
] as const;

/** Thrown when every provider fails — callers fall back to manual entry. */
export class LlmUnavailableError extends Error {
  constructor(message = 'All LLM providers unavailable — fall back to manual entry.') {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}

/**
 * Read a provider's API key. MUST use static EXPO_PUBLIC_ literals — Expo/Metro
 * only inlines `process.env.EXPO_PUBLIC_X` when accessed by literal, never via a
 * computed key. A provider with no key returns undefined and is skipped (this is
 * how "Gemini only in beta" falls out — see L12).
 */
export function apiKeyFor(id: ProviderId): string | undefined {
  switch (id) {
    case 'gemini':
      return process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    case 'groq':
      return process.env.EXPO_PUBLIC_GROQ_API_KEY;
    case 'openrouter':
      return process.env.EXPO_PUBLIC_OPENROUTER_API_KEY;
  }
}

export type ProviderCallResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'rate_limited' | 'error' };

/**
 * Call one provider and return its raw text completion (expected JSON — the
 * caller validates with zod). This is the HTTP-only seam unit tests mock.
 * Gemini uses generateContent; Groq/OpenRouter use the OpenAI-compatible
 * chat-completions API. 429 → rate_limited so the chain can fall through.
 */
export async function callProvider(
  config: ProviderConfig,
  systemPrompt: string,
  userInput: string,
): Promise<ProviderCallResult> {
  const apiKey = apiKeyFor(config.id);
  if (!apiKey) return { ok: false, reason: 'error' };

  try {
    if (config.id === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Required for the Google Cloud iOS key restriction (L12): a key
            // restricted to this bundle id rejects requests without the header.
            'X-Ios-Bundle-Identifier': 'com.floq.app',
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userInput }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
              // Force the exact shape so the model can't return prose/markdown.
              // zod still enforces the value ranges (e.g. difficulty 1-5) after.
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  tasks: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        title: { type: 'STRING' },
                        estMinutes: { type: 'INTEGER' },
                        difficulty: { type: 'INTEGER' },
                      },
                      required: ['title', 'estMinutes', 'difficulty'],
                      propertyOrdering: ['title', 'estMinutes', 'difficulty'],
                    },
                  },
                },
                required: ['tasks'],
              },
            },
          }),
        },
      );
      if (res.status === 429) return { ok: false, reason: 'rate_limited' };
      if (!res.ok) return { ok: false, reason: 'error' };
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return typeof text === 'string' ? { ok: true, text } : { ok: false, reason: 'error' };
    }

    // Groq + OpenRouter: OpenAI-compatible chat completions.
    const endpoint =
      config.id === 'groq'
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });
    if (res.status === 429) return { ok: false, reason: 'rate_limited' };
    if (!res.ok) return { ok: false, reason: 'error' };
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content;
    return typeof text === 'string' ? { ok: true, text } : { ok: false, reason: 'error' };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
