import { z } from "zod";
import {
  ILlmClient,
  LlmPrompt,
  LlmCallTrace,
  LlmProviderConfig,
} from "./types.js";
import { CircuitBreaker } from "./circuitBreaker.js";
import { DevCache } from "./devCache.js";

interface ProviderRuntime {
  config: LlmProviderConfig;
  circuitBreaker: CircuitBreaker;
  isExhausted: boolean;
}

export function loadProvidersFromEnv(): LlmProviderConfig[] {
  const configs: LlmProviderConfig[] = [];

  // Check numbered providers: LLM_PROVIDER_1_* through LLM_PROVIDER_3_*
  for (let i = 1; i <= 5; i++) {
    const key = process.env[`LLM_PROVIDER_${i}_API_KEY`];
    if (key && key.trim()) {
      configs.push({
        name: process.env[`LLM_PROVIDER_${i}_NAME`] || `provider-${i}`,
        baseUrl:
          process.env[`LLM_PROVIDER_${i}_BASE_URL`] ||
          "https://generativelanguage.googleapis.com/v1beta/openai",
        apiKey: key.trim(),
        model: process.env[`LLM_PROVIDER_${i}_MODEL`] || "gemini-3.1-flash-lite",
        rpm: parseInt(process.env[`LLM_PROVIDER_${i}_RPM`] || "15", 10),
        tpm: parseInt(process.env[`LLM_PROVIDER_${i}_TPM`] || "250000", 10),
        concurrency: parseInt(process.env[`LLM_PROVIDER_${i}_CONCURRENCY`] || "1", 10),
      });
    }
  }

  // Fallback to legacy un-numbered env vars if no numbered ones exist
  if (configs.length === 0 && process.env["LLM_API_KEY"]) {
    configs.push({
      name: "default",
      baseUrl: process.env["LLM_BASE_URL"] || "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: process.env["LLM_API_KEY"].trim(),
      model: process.env["LLM_MODEL"] || "gemini-3.1-flash-lite",
    });
  }

  return configs;
}

export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenceRegex = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i;
  const match = fenceRegex.exec(trimmed);
  return match && match[1] ? match[1].trim() : trimmed;
}

export class MultiProviderLlmClient implements ILlmClient {
  private providers: ProviderRuntime[];
  private traces: LlmCallTrace[] = [];
  private cache: DevCache;
  private fetchFn: typeof fetch;

  constructor(
    configs: LlmProviderConfig[] = loadProvidersFromEnv(),
    options: { fetchFn?: typeof fetch; customCacheDir?: string } = {}
  ) {
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.cache = new DevCache(options.customCacheDir);
    this.providers = configs.map((cfg) => ({
      config: cfg,
      circuitBreaker: new CircuitBreaker({ failureThreshold: 3, cooldownMs: 60_000 }),
      isExhausted: false,
    }));
  }

  public getTraces(): LlmCallTrace[] {
    return [...this.traces];
  }

  public clearTraces(): void {
    this.traces = [];
  }

  public getAvailableProviders(): string[] {
    return this.providers
      .filter((p) => !p.isExhausted && p.circuitBreaker.canExecute())
      .map((p) => p.config.name);
  }

  private isDailyQuotaError(status: number, responseText: string, retryAfterSeconds: number): boolean {
    if (status !== 429) return false;
    if (retryAfterSeconds > 60) return true;
    const lower = responseText.toLowerCase();
    return (
      lower.includes("resource_exhausted") ||
      lower.includes("daily") ||
      lower.includes("quota") ||
      lower.includes("exceeded your current quota") ||
      lower.includes("insufficient")
    );
  }

  private async callProviderOnce(
    provider: ProviderRuntime,
    prompt: LlmPrompt
  ): Promise<{ status: number; text: string; retryAfterSeconds: number }> {
    let endpoint = provider.config.baseUrl.replace(/\/+$/, "");
    if (!endpoint.endsWith("/chat/completions")) {
      endpoint = `${endpoint}/chat/completions`;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.config.apiKey}`,
    };

    const body = JSON.stringify({
      model: provider.config.model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const res = await this.fetchFn(endpoint, {
      method: "POST",
      headers,
      body,
    });

    const retryAfterHeader = res.headers?.get?.("retry-after");
    const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) || 0 : 0;
    const text = await res.text();

    return {
      status: res.status,
      text,
      retryAfterSeconds,
    };
  }

  public async generateJson<T>(prompt: LlmPrompt, schema: z.ZodType<T>): Promise<T> {
    const inputChars = (prompt.system?.length ?? 0) + (prompt.user?.length ?? 0);
    const stepName = prompt.stepName ?? "unspecified";

    // 1. Check development cache first
    for (const p of this.providers) {
      const cached = this.cache.get<T>({
        provider: p.config.name,
        model: p.config.model,
        system: prompt.system,
        user: prompt.user,
      });
      if (cached !== null) {
        this.traces.push({
          stepName,
          provider: p.config.name,
          model: p.config.model,
          inputChars,
          outputChars: JSON.stringify(cached).length,
          latencyMs: 0,
          attempts: 1,
          outcome: "ok",
        });
        return cached;
      }
    }

    if (this.providers.length === 0) {
      throw new Error("LLM_UNAVAILABLE: No LLM providers configured with valid API keys.");
    }

    let lastError: Error | null = null;

    // 2. Iterate through ordered provider fallback chain
    for (const provider of this.providers) {
      if (provider.isExhausted) {
        continue;
      }

      if (!provider.circuitBreaker.canExecute()) {
        continue;
      }

      const startTime = Date.now();
      let attemptCount = 0;
      let workingUserPrompt = prompt.user;

      // Allow 1 repair attempt if JSON schema validation fails
      for (let repairRound = 0; repairRound < 2; repairRound++) {
        attemptCount++;

        let res: { status: number; text: string; retryAfterSeconds: number };
        try {
          res = await this.callProviderOnce(provider, {
            ...prompt,
            user: workingUserPrompt,
          });
        } catch (netErr: unknown) {
          provider.circuitBreaker.recordFailure();
          lastError = netErr instanceof Error ? netErr : new Error(String(netErr));
          break; // Try next provider
        }

        // Daily quota exhaustion discrimination
        if (this.isDailyQuotaError(res.status, res.text, res.retryAfterSeconds)) {
          provider.isExhausted = true;
          this.traces.push({
            stepName,
            provider: provider.config.name,
            model: provider.config.model,
            inputChars,
            outputChars: 0,
            latencyMs: Date.now() - startTime,
            attempts: attemptCount,
            outcome: "fallback",
            error: "DAILY_QUOTA_EXHAUSTED",
          });
          break; // Switch to next provider immediately!
        }

        // Per-minute 429 rate limit: back off and retry up to 2 times
        if (res.status === 429) {
          const waitMs = Math.min(
            60_000,
            (res.retryAfterSeconds > 0 ? res.retryAfterSeconds : 2) * 1000
          );
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }

        // 5xx error: trip circuit breaker and try next provider
        if (res.status >= 500) {
          provider.circuitBreaker.recordFailure();
          lastError = new Error(`Provider ${provider.config.name} HTTP ${res.status}: ${res.text}`);
          break;
        }

        // Other 4xx error: unrecoverable for this provider
        if (res.status >= 400) {
          provider.circuitBreaker.recordFailure();
          lastError = new Error(`Provider ${provider.config.name} client error ${res.status}: ${res.text}`);
          break;
        }

        // 200 OK: Parse response and validate schema
        try {
          const responseJson = JSON.parse(res.text) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const rawContent = responseJson.choices?.[0]?.message?.content ?? "";
          const stripped = stripCodeFences(rawContent);
          const parsedObj = JSON.parse(stripped);
          const validated = schema.parse(parsedObj);

          // Success! Record to circuit breaker, cache, and trace.
          provider.circuitBreaker.recordSuccess();

          this.cache.set(
            {
              provider: provider.config.name,
              model: provider.config.model,
              system: prompt.system,
              user: prompt.user,
            },
            validated
          );

          this.traces.push({
            stepName,
            provider: provider.config.name,
            model: provider.config.model,
            inputChars,
            outputChars: JSON.stringify(validated).length,
            latencyMs: Date.now() - startTime,
            attempts: attemptCount,
            outcome: "ok",
          });

          return validated;
        } catch (parseOrValidationError: unknown) {
          const errMsg =
            parseOrValidationError instanceof Error
              ? parseOrValidationError.message
              : String(parseOrValidationError);

          if (repairRound === 0) {
            // Repair round: append schema error message to user prompt and retry once
            workingUserPrompt = `${prompt.user}\n\n[SYSTEM NOTICE: Your previous output failed schema validation: ${errMsg}. Please return strictly conforming JSON.]`;
            continue;
          } else {
            lastError = new Error(`LLM_INVALID_OUTPUT: ${errMsg}`);
            break;
          }
        }
      }
    }

    throw lastError ?? new Error("LLM_UNAVAILABLE: All configured LLM providers failed or exhausted.");
  }
}
