import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { parseChain, type ModelTarget } from "@/server/ai/chain";
import { AllModelsFailedError, ProviderError, benchUntil, looksLikeDailyQuota, parseRetryAfter } from "@/server/ai/errors";
import { extractJson } from "@/server/ai/json";
import type { CompleteFn } from "@/server/ai/providers";
import { runChain, type RouterDeps } from "@/server/ai/router";

const chain = parseChain("gemini:g-flash,groq:openai/gpt-oss-120b,openrouter:vendor/model:free");
const schema = z.object({ answer: z.string() });
const messages = [{ role: "user" as const, content: "hi" }];

function deps(complete: CompleteFn, benched: string[] = []) {
  const bench = vi.fn(async () => {});
  const log = vi.fn(async () => {});
  const d: RouterDeps = {
    complete,
    getBenched: async () => new Set(benched),
    bench,
    log,
    now: () => new Date("2026-09-24T10:00:00Z"),
  };
  return { d, bench, log };
}

/** A fake provider that answers per model id. */
function scripted(script: Record<string, Array<string | ProviderError>>): CompleteFn & { calls: string[] } {
  const calls: string[] = [];
  const fn: CompleteFn = async (target: ModelTarget) => {
    calls.push(target.id);
    const next = script[target.id]?.shift();
    if (next === undefined) throw new ProviderError("server", "no script", 500);
    if (next instanceof ProviderError) throw next;
    return { text: next, promptTokens: 10, completionTokens: 5 };
  };
  return Object.assign(fn, { calls });
}

describe("parseChain", () => {
  it("keeps OpenRouter's :free suffix and skips unknown providers or placeholders", () => {
    expect(chain.map((c) => c.id)).toEqual([
      "gemini:g-flash",
      "groq:openai/gpt-oss-120b",
      "openrouter:vendor/model:free",
    ]);
    expect(parseChain("nope:x, ,gemini:<fill-me>,groq:m")).toEqual([
      { provider: "groq", model: "m", id: "groq:m" },
    ]);
    expect(parseChain(undefined)).toEqual([]);
  });
});

describe("runChain fallback", () => {
  it("returns the first model's valid answer", async () => {
    const complete = scripted({ "gemini:g-flash": ['{"answer":"ok"}'] });
    const { d } = deps(complete);
    const res = await runChain({ task: "t", chain, messages, schema }, d);
    expect(res).toEqual({ data: { answer: "ok" }, model: "gemini:g-flash" });
    expect(complete.calls).toEqual(["gemini:g-flash"]);
  });

  it("benches a model on 429 using retry-after and moves on", async () => {
    const complete = scripted({
      "gemini:g-flash": [new ProviderError("rate_limit", "slow down", 429, 30_000)],
      "groq:openai/gpt-oss-120b": ['```json\n{"answer":"from groq"}\n```'],
    });
    const { d, bench } = deps(complete);
    const res = await runChain({ task: "t", chain, messages, schema }, d);
    expect(res.data.answer).toBe("from groq");
    expect(bench).toHaveBeenCalledWith("gemini:g-flash", new Date("2026-09-24T10:00:30Z"), "rate_limit");
  });

  it("benches until midnight UTC when the daily quota is used up", async () => {
    const complete = scripted({
      "gemini:g-flash": [new ProviderError("rate_limit", "quota per day", 429, undefined, true)],
      "groq:openai/gpt-oss-120b": ['{"answer":"x"}'],
    });
    const { d, bench } = deps(complete);
    await runChain({ task: "t", chain, messages, schema }, d);
    expect(bench).toHaveBeenCalledWith("gemini:g-flash", new Date("2026-09-25T00:00:00Z"), "daily_quota");
  });

  it("falls back on 5xx, timeout and network errors without benching", async () => {
    const complete = scripted({
      "gemini:g-flash": [new ProviderError("server", "boom", 503)],
      "groq:openai/gpt-oss-120b": [new ProviderError("timeout", "timeout")],
      "openrouter:vendor/model:free": ['{"answer":"third"}'],
    });
    const { d, bench } = deps(complete);
    const res = await runChain({ task: "t", chain, messages, schema }, d);
    expect(res.model).toBe("openrouter:vendor/model:free");
    expect(bench).not.toHaveBeenCalled();
  });

  it("retries once with a JSON nudge on invalid output, then moves on", async () => {
    const complete = scripted({
      "gemini:g-flash": ["not json", '{"wrong":1}'],
      "groq:openai/gpt-oss-120b": ["still not json", '{"answer":"fixed"}'],
    });
    const { d } = deps(complete);
    const res = await runChain({ task: "t", chain, messages, schema }, d);
    expect(res).toEqual({ data: { answer: "fixed" }, model: "groq:openai/gpt-oss-120b" });
    expect(complete.calls).toEqual([
      "gemini:g-flash",
      "gemini:g-flash",
      "groq:openai/gpt-oss-120b",
      "groq:openai/gpt-oss-120b",
    ]);
  });

  it("skips benched models", async () => {
    const complete = scripted({ "groq:openai/gpt-oss-120b": ['{"answer":"g"}'] });
    const { d } = deps(complete, ["gemini:g-flash"]);
    const res = await runChain({ task: "t", chain, messages, schema }, d);
    expect(complete.calls).toEqual(["groq:openai/gpt-oss-120b"]);
    expect(res.data.answer).toBe("g");
  });

  it("throws AllModelsFailedError when everything fails", async () => {
    const complete = scripted({});
    const { d, log } = deps(complete);
    await expect(runChain({ task: "t", chain, messages, schema }, d)).rejects.toBeInstanceOf(AllModelsFailedError);
    expect(log).toHaveBeenCalledTimes(3);
  });

  it("logs metadata only (no content)", async () => {
    const complete = scripted({ "gemini:g-flash": ['{"answer":"secret notes"}'] });
    const { d, log } = deps(complete);
    await runChain({ task: "summary", chain, messages, schema, userId: "u1" }, d);
    const entry = (log.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(Object.keys(entry).sort()).toEqual(
      ["completionTokens", "latencyMs", "model", "promptTokens", "provider", "status", "task", "userId"].sort(),
    );
    expect(JSON.stringify(entry)).not.toContain("secret notes");
  });

  it("returns plain text when no schema is given", async () => {
    const complete = scripted({ "gemini:g-flash": ["  hello  "] });
    const { d } = deps(complete);
    expect((await runChain({ task: "t", chain, messages }, d)).data).toBe("hello");
  });
});

describe("error helpers", () => {
  const now = new Date("2026-09-24T10:00:00Z");

  it("parses Retry-After seconds, HTTP dates and Groq reset headers", () => {
    expect(parseRetryAfter(new Headers({ "retry-after": "12" }), now)).toBe(12_000);
    expect(parseRetryAfter(new Headers({ "retry-after": "Thu, 24 Sep 2026 10:01:00 GMT" }), now)).toBe(60_000);
    expect(parseRetryAfter(new Headers({ "x-ratelimit-reset-requests": "2m59.5s" }), now)).toBe(179_500);
    expect(parseRetryAfter(new Headers({ "x-ratelimit-reset-tokens": "7.66s" }), now)).toBeCloseTo(7660);
    expect(parseRetryAfter(new Headers(), now)).toBeUndefined();
  });

  it("benches 10 minutes when the reset time is unknown", () => {
    expect(benchUntil(new ProviderError("rate_limit", "x", 429), now)).toEqual(new Date("2026-09-24T10:10:00Z"));
  });

  it("detects daily quota messages", () => {
    expect(looksLikeDailyQuota("Rate limit exceeded: free-models-per-day")).toBe(true);
    expect(looksLikeDailyQuota("Quota exceeded for metric requests per day")).toBe(true);
    expect(looksLikeDailyQuota("Too many requests per minute")).toBe(false);
  });
});

describe("extractJson", () => {
  it("handles fences, chatter and <think> blocks", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure! Here it is: {"a":[1,2]} Hope it helps')).toEqual({ a: [1, 2] });
    expect(extractJson('<think>hmm {"no":1}</think>{"a":2}')).toEqual({ a: 2 });
    expect(() => extractJson("no json here")).toThrow();
  });
});
