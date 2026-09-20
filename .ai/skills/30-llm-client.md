---
name: llm-client
load_when: implementing or changing the model adapter, limiter, retries, fallback chain or dev cache
depends_on: [00-rules, 11-architecture]
related: [23-prompt-safety, 41-batch-cli]
code: packages/core/src/llm
---

# Llm client

## D2. LLM provider and model

- **Criteria**: a real free tier, JSON output mode or structured output support, a context window of at least 16k tokens, free-tier limits that fit your call budget (see 6.13), and a signup that works from your own country.
- **How to choose**: check the provider's current documentation for requests per minute (RPM), tokens per minute (TPM) and requests per day (RPD). Free-tier limits change. Then run 20 real calls with your real prompt sizes and record how many return 429 and the median latency.
- **Current recommendation (checked in September 2026, so verify before you rely on it)**:
  - **Primary**: Gemini Flash-Lite (`gemini-3.1-flash-lite` or `gemini-3.5-flash-lite`) on Google's free tier. Trackers list about 500 requests per day for the Flash-Lite models and about 20 per day for the larger Flash models. A 5-case batch needs roughly 40 to 60 calls, so a 20-per-day model cannot finish one run and must not be your default. One tracker lists 15 RPM and 250K TPM for 3.1 Flash-Lite. Read the real numbers for your project at aistudio.google.com/rate-limit and write them down.
  - **Fallbacks, ordered and all optional**: Mistral free mode first (no card, possible SMS verification, about 1 request per second reported, turn off training data sharing in the Admin Console under Privacy). GLM-4.7-Flash on the international z.ai endpoint second (email signup, 1 concurrent request, so run it with concurrency 1).
  - **Not usable for you or not free**: Alibaba Qwen (the international console ties your phone number to the country chosen at signup, and you found India is not offered), DeepSeek and Kimi (paid), OpenRouter free models (50 requests per day until you buy credits), Cerebras (a payment method is required before the credit works), Groq (free, but 8K tokens per minute, so suitable for small calls only).
  - **Data note**: free tiers can use your prompts for training (Gemini free tier, Mistral free mode by default). Say so in the README and never send private data through them.
- **Design for graders swapping keys**: the graders run your command with credentials from `.env.example`. Use an adapter with environment-driven settings (`LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `LLM_RPM`, `LLM_TPM`, `LLM_CONCURRENCY`). Many providers, including several with free tiers, offer OpenAI-compatible endpoints, which lets a grader change provider by changing environment values only. Confirm this for your provider.
- **Design for missing keys**: the fallback list is generic (numbered environment variables, see 5.4), never tied to one vendor. A missing fallback key means a single-provider run, never a crash.
- **Record**: provider, model, limits and the date you checked them, plus the ordered fallback list.

## 6.13 LLM client and provider rate limits

**Brief**: "A pipeline that falls over the first time a provider says slow down is the most common way to lose points." The same goes for a briefly failing provider.

- **AGENT**: a queue, retry logic, request logging.
- **GUIDE (spec)**:
  - One shared limiter for the whole process, so concurrent cases in the batch still respect provider limits. It enforces `LLM_RPM`, `LLM_TPM` and `LLM_CONCURRENCY` (start at 1 or 2). Estimate tokens before each call as characters divided by 4.
  - On 429, wait for the `Retry-After` value if present. Otherwise use exponential backoff starting at 2 seconds, doubling, with 25% random jitter, capped at 60 seconds, at most 5 attempts.
  - Retry 5xx responses and network errors the same way. Do not retry other 4xx responses except 408.
  - **Two kinds of 429**. A per-minute limit gets `Retry-After` or backoff. A daily quota that is used up gets no benefit from waiting: treat a 429 with a wait longer than about 60 seconds, or an error message naming a daily quota, as exhaustion. Mark that provider exhausted for the rest of the run and fail over at once.
  - **Provider chain**: an ordered list built from environment variables. Providers with no key are skipped. With one provider, the pipeline runs single-provider and reports `LLM_UNAVAILABLE` only when it is exhausted.
  - **Circuit breaker**: after 3 consecutive failures, skip a provider for a cooldown (for example 60 seconds), then let one trial call through.
  - **Per-step model**: allow `LLM_MODEL_EXTRACT` so the 20-point extraction step can use a stronger model than the other steps. One call per case keeps it inside a small daily quota.
  - **Dev only cache**: when `LLM_DEV_CACHE=1`, store responses in a git-ignored folder keyed by a hash of provider, model and prompt. It protects your daily quota while you debug. It is off by default and never active in the batch run graders use.
  - **Call accounting**: log the number of live calls per run and per day, so you notice before the quota runs out.
  - Trim every prompt to a fixed budget: 6,000 characters per page, 20,000 characters in total for pages.
  - Use the provider's JSON or structured-output mode if it has one. Set a low temperature, such as 0.2.
  - Record every call in a trace: step name, provider, model, input size, latency, attempts, outcome. The trace feeds the job progress view and your video.
  - **Invalid JSON**: strip code fences, parse, validate against the step's schema. On failure, retry once with the validation error appended to the prompt. After 2 failures the step reports `LLM_INVALID_OUTPUT`. Each step has a defined fallback: flashcards derive from questions (6.10), a failed category leaves its requirements to the coverage loop (6.11), the brief falls back to the honest deterministic brief (6.8). Extraction has no fallback, so it fails the case with `EXTRACTION_FAILED`.
  - **Injected client**: the LLM client is passed into `runPipeline`. Tests use a fake client, so they run without network or key.
- **YOU (budget)**: a rough call budget with numbers.

| Step              | Calls              |
| ----------------- | ------------------ |
| Extraction        | 1                  |
| Interview process | 0 or 1             |
| Company brief     | 0 or 1             |
| Questions         | 4                  |
| Flashcards        | 1                  |
| Coverage repair   | 0 to 2             |
| Retries           | a few              |
| **Per case**      | **about 8 to 12**  |
| **5 cases**       | **about 40 to 60** |

Over 15 minutes that is roughly 3 to 4 calls per minute, which fits most free-tier RPM limits. Tokens matter more: if an average call carries 4,000 input tokens, 50 calls send about 200,000 tokens, or about 13,000 per minute over 15 minutes. Compare that figure with your provider's TPM limit. If it is tight, cut calls: derive flashcards in code, skip categories with no requirements, skip the process call when there is no hiring text, cap repairs at 1.

- **Test yourself**: run the 5-case batch and record wall-clock time, calls and retries. Put the real numbers in the README.

## Done when
- A fake client exists and every step test uses it.
- Tests cover: 429 with Retry-After, daily quota exhaustion failing over, circuit breaker cooldown, missing fallback key, invalid JSON retry once, call trace with provider and model.
- Live calls exist only in npm run test:live.
- The real limits for the chosen model are recorded in DECISIONS.md with the date.

---
Section numbers such as 6.11 in this file refer to the master plan. The map in `.ai/README.md` says which skill holds each section.
