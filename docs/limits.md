# Limits and the AI fallback chain

Kodigo runs on free AI tiers, so it protects itself with per-user limits, a global daily budget, and a chain of models it can fall back to.

## Per-user limits

All counters live in Postgres (`usage_counters`, `rate_events`, `global_usage`) and are updated with atomic upserts, so there's no Redis.

| Limit | Env var | Default | Counts |
| --- | --- | --- | --- |
| Set generations per day | `DAILY_GENERATIONS_PER_USER` | 20 | New set generation, photo → text |
| Tutor messages per day | `DAILY_TUTOR_MESSAGES_PER_USER` | 60 | Phase 2 tutor chat |
| Assist actions per day | `DAILY_ASSIST_ACTIONS_PER_USER` | 15 | Explain simpler, give an example, quiz generation (Phase 2) |
| Requests per minute | `REQUESTS_PER_MINUTE_PER_USER` | 5 | Any AI action (sliding 60-second window) |
| Max input size | `MAX_INPUT_CHARS` | 60,000 | Characters of notes per generation |
| Sign-ups per IP per hour | `SIGNUPS_PER_IP_PER_HOUR` | 3 | On top of Turnstile; IPs are stored hashed |

- The day resets at **midnight Asia/Manila** (UTC+8).
- **Cached results are free.** The cache key is sha256(task + language + normalized notes). The same notes in the same language return the stored result without calling the AI or using allowance.
- If every model fails, the unit is **refunded**.
- Suspended users (admin page) can still study but can't use AI.

Upload caps (checked in the browser and again on the server): 4 photos per generation (≤1600px JPEG), PDF ≤ 10 MB and 30 pages, PPTX ≤ 10 MB.

## Global budget

`GLOBAL_DAILY_AI_BUDGET` is the total number of AI calls per day across everyone. Each chunk or photo call counts as one. At **90%**, new AI calls stop: users see a banner, and cached results plus all study modes keep working.

## The fallback chain

`AI_TEXT_CHAIN` and `AI_VISION_CHAIN` are comma-separated `provider:model` lists, tried in order:

```
AI_TEXT_CHAIN=gemini:gemini-3.5-flash-lite,groq:openai/gpt-oss-120b,groq:qwen/qwen3.8-27b,openrouter:google/gemma-4-31b-it:free
```

Providers are `gemini`, `groq` and `openrouter`. Only the first `:` splits provider from model, so OpenRouter's `:free` suffix is kept.

For each call, the router (`src/server/ai/router.ts`):

1. Skips models that are **benched** (`ai_model_status.benched_until` is in the future).
2. Calls the model with a 25 s timeout (`AI_TIMEOUT_MS`).
3. Moves to the next model on HTTP 429, 5xx, timeout, network error, or an empty reply.
4. If the reply isn't valid JSON of the expected shape, it retries **once** on the same model with a "JSON only" nudge, then moves on.
5. On **429** it benches the model until the `Retry-After` / `x-ratelimit-reset-*` time, or **10 minutes** if unknown, or **midnight UTC** if the error says the daily quota is gone.
6. On 401/403/404 (bad key or the model was removed) it benches the model for 10 minutes.
7. If nothing works, the user sees the translated "Kodigo is resting, try again in a bit" message.

Every attempt is logged to `ai_call_logs` with provider, model, task, status, latency and token counts. **Note content is never logged.**

Long notes are split into ~12k-character chunks (`AI_CHUNK_CHARS`). Each chunk is generated separately, then the summaries are joined and the cards de-duplicated (capped at 60).

## When a free model disappears

Free models come and go. Signs: the admin page shows a model benched with `http_404`, or `ai_call_logs` shows repeated `client` errors for it.

1. Find a replacement:
   - Gemini: https://ai.google.dev/gemini-api/docs/models (use a `flash` or `flash-lite` model)
   - Groq: https://console.groq.com/docs/models
   - OpenRouter: https://openrouter.ai/models?max_price=0 (IDs end in `:free`; for the vision chain, pick one that accepts image input)
2. Update `AI_TEXT_CHAIN` / `AI_VISION_CHAIN` in Vercel → Project → Settings → Environment Variables.
3. Redeploy (env var changes need a new deployment).

No code change is needed. Put the most reliable model first. Order matters because every request starts at the top.

To clear a bench early, delete its row from `ai_model_status` (for example in `npm run db:studio`).
