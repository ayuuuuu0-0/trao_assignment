import { z } from "zod";

export interface LlmPrompt {
  system: string;
  user: string;
  stepName?: string;
}

export interface LlmCallTrace {
  stepName: string;
  provider: string;
  model: string;
  inputChars: number;
  outputChars: number;
  latencyMs: number;
  attempts: number;
  outcome: "ok" | "fallback" | "error";
  error?: string;
}

export interface ILlmClient {
  generateJson<T>(prompt: LlmPrompt, schema?: z.ZodType<T>): Promise<T>;
  getTraces(): LlmCallTrace[];
}

export interface LlmProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  rpm?: number;
  tpm?: number;
  concurrency?: number;
}
