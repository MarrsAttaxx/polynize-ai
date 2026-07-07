import { NO_EM_DASH_INSTRUCTION } from '../em-dash';
import { completeWithKimi } from './kimi';
import { completeWithOpenAI } from './openai';
import { completeWithOpenRouter } from './openrouter';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type CompleteArgs = {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /**
   * Request structured JSON output where the provider supports it (OpenRouter's
   * response_format). Defaults to true to preserve the behavior the JSON-consuming
   * callers rely on. Set false for prose/Markdown prompts (e.g. the intake
   * interview and concept doc), which must NOT be wrapped in a JSON object.
   */
  json?: boolean;
  /**
   * Override the provider API key for this call (OpenRouter). Used to bill a
   * specific agent's key when the console runs that agent's cognition on its
   * behalf (e.g. the console-run interview bills April's key). Falls back to the
   * provider's env key when unset.
   */
  apiKey?: string;
};

/**
 * Single entry point for LLM calls. Default provider is OpenRouter, so the
 * model is chosen programmatically (base model via OPENROUTER_MODEL, e.g. a
 * DeepSeek model). Per-agent API keys are supported by the caller/provider.
 *
 * Override via LLM_PROVIDER:
 *   - 'openrouter'             → OpenRouter (default; model via OPENROUTER_MODEL env)
 *   - 'openai'                 → OpenAI (model defaults to gpt-4o)
 *   - 'kimi'                   → Moonshot (model defaults to moonshot-v1-128k)
 *   - 'minimax'                → legacy alias, routed through OpenRouter
 *
 * Every call gets the em-dash prohibition appended to the system prompt
 * regardless of provider. The provider abstraction is one-file-thick so
 * future swaps (Anthropic, Mistral, etc.) are trivial.
 */
export async function complete(args: CompleteArgs): Promise<string> {
  const provider = process.env.LLM_PROVIDER ?? 'openrouter';
  const system = `${args.system}\n\n${NO_EM_DASH_INSTRUCTION}`;

  switch (provider) {
    case 'kimi':
    case 'moonshot':
      return completeWithKimi({ ...args, system });
    case 'openai':
      return completeWithOpenAI({ ...args, system });
    case 'minimax':
    case 'openrouter':
      return completeWithOpenRouter({ ...args, system });
    default:
      throw new Error(`Unknown LLM_PROVIDER: ${provider}`);
  }
}
