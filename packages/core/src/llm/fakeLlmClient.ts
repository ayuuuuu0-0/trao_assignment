import { z } from "zod";
import { ILlmClient, LlmPrompt, LlmCallTrace } from "./types.js";

export type FakeResponseHandler = (
  prompt: LlmPrompt,
  schema: z.ZodType<any>
) => Promise<any> | any;

export class FakeLlmClient implements ILlmClient {
  private handler: FakeResponseHandler;
  private traces: LlmCallTrace[] = [];

  constructor(handlerOrStaticResponse: FakeResponseHandler | Record<string, any>) {
    if (typeof handlerOrStaticResponse === "function") {
      this.handler = handlerOrStaticResponse as FakeResponseHandler;
    } else {
      this.handler = () => handlerOrStaticResponse;
    }
  }


  public async generateJson<T>(prompt: LlmPrompt, schema: z.ZodType<T>): Promise<T> {
    const start = Date.now();
    const inputChars = (prompt.system?.length ?? 0) + (prompt.user?.length ?? 0);

    try {
      const raw = await this.handler(prompt, schema);
      const parsed = schema.parse(raw);
      const outputChars = JSON.stringify(parsed).length;

      this.traces.push({
        stepName: prompt.stepName ?? "unknown",
        provider: "fake-provider",
        model: "fake-model",
        inputChars,
        outputChars,
        latencyMs: Date.now() - start,
        attempts: 1,
        outcome: "ok",
      });

      return parsed;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.traces.push({
        stepName: prompt.stepName ?? "unknown",
        provider: "fake-provider",
        model: "fake-model",
        inputChars,
        outputChars: 0,
        latencyMs: Date.now() - start,
        attempts: 1,
        outcome: "error",
        error: errorMsg,
      });
      throw err;
    }
  }

  public getTraces(): LlmCallTrace[] {
    return [...this.traces];
  }

  public clearTraces(): void {
    this.traces = [];
  }
}
