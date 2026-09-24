import "server-only";
import OpenAI, { APIConnectionTimeoutError, APIError } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ModelTarget, Provider } from "./chain";
import { ProviderError, looksLikeDailyQuota, parseRetryAfter } from "./errors";

export type ChatMessage = ChatCompletionMessageParam;

export type CompletionRequest = {
  messages: ChatMessage[];
  timeoutMs: number;
  maxTokens?: number;
};

export type CompletionResult = {
  text: string;
  promptTokens?: number;
  completionTokens?: number;
};

export type CompleteFn = (target: ModelTarget, req: CompletionRequest) => Promise<CompletionResult>;

const BASE_URLS: Record<Provider, string> = {
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
};

const KEY_VARS: Record<Provider, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

const clients = new Map<Provider, OpenAI>();

function client(provider: Provider): OpenAI {
  let c = clients.get(provider);
  if (!c) {
    const apiKey = process.env[KEY_VARS[provider]];
    if (!apiKey) throw new ProviderError("client", `${provider} key missing`, 401);
    c = new OpenAI({
      apiKey,
      baseURL: BASE_URLS[provider],
      maxRetries: 0, // the router handles fallback itself
      defaultHeaders:
        provider === "openrouter"
          ? { "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://kodigo.app", "X-Title": "Kodigo" }
          : undefined,
    });
    clients.set(provider, c);
  }
  return c;
}

/** One OpenAI-compatible call. Throws ProviderError on any failure. */
export const complete: CompleteFn = async (target, req) => {
  try {
    const res = await client(target.provider).chat.completions.create(
      {
        model: target.model,
        messages: req.messages,
        temperature: 0.3,
        max_tokens: req.maxTokens ?? 8192,
      },
      { timeout: req.timeoutMs },
    );
    const text = res.choices[0]?.message?.content ?? "";
    if (!text.trim()) throw new ProviderError("empty", "empty response");
    return {
      text,
      promptTokens: res.usage?.prompt_tokens,
      completionTokens: res.usage?.completion_tokens,
    };
  } catch (err) {
    throw toProviderError(err);
  }
};

function toProviderError(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err;
  if (err instanceof APIConnectionTimeoutError) return new ProviderError("timeout", "timeout");
  if (err instanceof APIError) {
    const status = err.status;
    // Keep only a short, content-free error message.
    const message = (err.message ?? "").slice(0, 200);
    if (status === 429) {
      return new ProviderError(
        "rate_limit",
        message,
        429,
        parseRetryAfter(err.headers ?? undefined),
        looksLikeDailyQuota(message),
      );
    }
    if (status === undefined) return new ProviderError("network", message);
    if (status >= 500) return new ProviderError("server", message, status);
    return new ProviderError("client", message, status);
  }
  const name = err instanceof Error ? err.name : "";
  if (name === "AbortError" || name === "TimeoutError") return new ProviderError("timeout", "timeout");
  return new ProviderError("network", err instanceof Error ? err.message.slice(0, 200) : "network error");
}
