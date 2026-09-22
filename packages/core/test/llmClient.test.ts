import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import {
  MultiProviderLlmClient,
  stripCodeFences,
} from "../src/llm/llmClient.js";
import { CircuitBreaker } from "../src/llm/circuitBreaker.js";
import { LlmProviderConfig } from "../src/llm/types.js";

describe("stripCodeFences", () => {
  it("strips ```json code fences", () => {
    const raw = '```json\n{\n  "name": "Alice"\n}\n```';
    expect(stripCodeFences(raw)).toBe('{\n  "name": "Alice"\n}');
  });

  it("strips generic ``` code fences", () => {
    const raw = '```\n{"key": "val"}\n```';
    expect(stripCodeFences(raw)).toBe('{"key": "val"}');
  });

  it("leaves standard un-fenced JSON untouched", () => {
    const raw = '{"key": "val"}';
    expect(stripCodeFences(raw)).toBe('{"key": "val"}');
  });
});

describe("CircuitBreaker", () => {
  it("trips after 3 consecutive failures and enters half-open after cooldown", () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 100 });
    expect(cb.getState()).toBe("CLOSED");
    expect(cb.canExecute()).toBe(true);

    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe("CLOSED");

    cb.recordFailure(); // 3rd failure
    expect(cb.getState()).toBe("OPEN");
    expect(cb.canExecute()).toBe(false);

    // After cooldown
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(cb.getState()).toBe("HALF_OPEN");
        expect(cb.canExecute()).toBe(true);
        cb.recordSuccess();
        expect(cb.getState()).toBe("CLOSED");
        resolve();
      }, 120);
    });
  });
});

describe("MultiProviderLlmClient - Fallback Chain & 429 Handling", () => {
  const TestSchema = z.object({
    result: z.string(),
  });

  const providers: LlmProviderConfig[] = [
    {
      name: "primary-gemini",
      baseUrl: "https://api.fake-gemini.com/v1",
      apiKey: "key-1",
      model: "gemini-3.1-flash-lite",
    },
    {
      name: "fallback-mistral",
      baseUrl: "https://api.fake-mistral.com/v1",
      apiKey: "key-2",
      model: "mistral-small",
    },
  ];

  it("succeeds on primary provider when response is 200 OK", async () => {
    const mockFetch = async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"result": "success"}' } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

    const client = new MultiProviderLlmClient(providers, {
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const data = await client.generateJson({ system: "sys", user: "usr" }, TestSchema);
    expect(data.result).toBe("success");

    const traces = client.getTraces();
    expect(traces.length).toBe(1);
    expect(traces[0].provider).toBe("primary-gemini");
    expect(traces[0].outcome).toBe("ok");
  });

  it("discriminates daily quota 429 and fails over immediately to fallback provider", async () => {
    let callCount = 0;
    const mockFetch = async (url: string | URL | Request) => {
      callCount++;
      const urlStr = String(url);
      if (urlStr.includes("fake-gemini")) {
        // Daily quota exhaustion error response
        return new Response(
          JSON.stringify({
            error: { message: "RESOURCE_EXHAUSTED: Daily quota exceeded for project." },
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      } else {
        // Fallback provider succeeds
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"result": "from-fallback"}' } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    };

    const client = new MultiProviderLlmClient(providers, {
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const data = await client.generateJson({ system: "sys", user: "usr" }, TestSchema);
    expect(data.result).toBe("from-fallback");

    const traces = client.getTraces();
    expect(traces.length).toBe(2);
    expect(traces[0].provider).toBe("primary-gemini");
    expect(traces[0].outcome).toBe("fallback");
    expect(traces[0].error).toBe("DAILY_QUOTA_EXHAUSTED");
    expect(traces[1].provider).toBe("fallback-mistral");
    expect(traces[1].outcome).toBe("ok");
  });

  it("handles 1-round JSON repair retry when initial response fails schema validation", async () => {
    let attempt = 0;
    const mockFetch = async () => {
      attempt++;
      if (attempt === 1) {
        // First attempt: missing required "result" property
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"wrong_key": 123}' } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } else {
        // Second attempt (repair): correct schema returned
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"result": "repaired"}' } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    };

    const client = new MultiProviderLlmClient(providers.slice(0, 1), {
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const data = await client.generateJson({ system: "sys", user: "usr" }, TestSchema);
    expect(data.result).toBe("repaired");
    expect(attempt).toBe(2);
  });

  it("trips circuit breaker on repeated 500 server errors and falls over to next provider", async () => {
    const mockFetch = async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes("fake-gemini")) {
        return new Response("Internal Server Error", { status: 500 });
      } else {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"result": "fallback-success"}' } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    };

    const client = new MultiProviderLlmClient(providers, {
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const data = await client.generateJson({ system: "sys", user: "usr" }, TestSchema);
    expect(data.result).toBe("fallback-success");
  });
});
