import { z } from "zod";
import { ProcessRecord, ProcessRound } from "../schema/kit.js";
import { ILlmClient } from "../llm/types.js";
import { wrapUntrusted, UNTRUSTED_DATA_SYSTEM_INSTRUCTION } from "../llm/wrapUntrusted.js";
import { CrawledPage } from "../retrieval/crawler.js";
import { DiscussionSource } from "../schema/kit.js";

const VALID_FORMATS = [
  "screen",
  "coding",
  "take-home",
  "system-design",
  "behavioural",
  "panel",
  "other",
] as const;

export const RawProcessRoundSchema = z.object({
  name: z.string(),
  format: z.enum(VALID_FORMATS),
  detail: z.string(),
  evidence: z.string().optional(),
  source_url: z.string().optional(),
});

export const RawProcessOutputSchema = z.object({
  found: z.boolean(),
  rounds: z.array(RawProcessRoundSchema),
  notes: z.string().optional(),
});

const PROCESS_SYSTEM_PROMPT = `${UNTRUSTED_DATA_SYSTEM_INSTRUCTION}

You are an expert interview coach extracting the interview stages and hiring process from company web pages and discussions.

Rules:
1. Return valid JSON adhering to the required schema.
2. Only mark "found": true if specific interview stages, rounds, or hiring steps are explicitly described.
3. Each round must classify its format into one of: "screen", "coding", "take-home", "system-design", "behavioural", "panel", "other".
4. Each round MUST include verbatim "evidence" text extracted directly from the provided source.
5. If no specific interview process is mentioned, return "found": false, "rounds": []. Never invent or assume standard interview stages.`;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

export async function extractProcess(
  hiringPages: CrawledPage[],
  discussionSources: DiscussionSource[],
  extraNotes: string | undefined,
  llmClient: ILlmClient
): Promise<ProcessRecord> {
  const parts: string[] = [];

  for (const page of hiringPages) {
    if (page.status === "fetched" && page.text?.trim()) {
      parts.push(`Hiring Page (${page.url}):\n${page.text.slice(0, 6000)}`);
    }
  }

  for (const disc of discussionSources) {
    if (disc.snippet?.trim()) {
      parts.push(`Public Discussion (${disc.url}):\n${disc.snippet}`);
    }
  }

  if (extraNotes?.trim()) {
    parts.push(`User Provided Notes:\n${extraNotes.trim()}`);
  }

  const combinedSourceText = parts.join("\n\n").trim();

  // If no hiring pages, discussion, or user notes exist: 0 model calls!
  if (!combinedSourceText || combinedSourceText.length < 50) {
    return {
      found: false,
      rounds: [],
      notes: "No public discussion or company hiring process pages found.",
    };
  }

  const userPrompt = `Extract the interview stages from the following sources:\n\n${wrapUntrusted("hiring-data", combinedSourceText)}`;

  try {
    const raw = await llmClient.generateJson(
      {
        system: PROCESS_SYSTEM_PROMPT,
        user: userPrompt,
        stepName: "extract-process",
      },
      RawProcessOutputSchema
    );

    if (!raw.found || raw.rounds.length === 0) {
      return {
        found: false,
        rounds: [],
        notes: raw.notes || "No structured hiring process found.",
      };
    }

    // Grounding check: verify round evidence exists in source text
    const groundedRounds: ProcessRound[] = [];
    const normSource = normalize(combinedSourceText);

    for (const round of raw.rounds) {
      if (round.evidence && round.evidence.trim()) {
        const normEvidence = normalize(round.evidence);
        if (normSource.includes(normEvidence)) {
          groundedRounds.push(round);
        }
      } else {
        // If round has no evidence, check if detail is grounded
        const normDetail = normalize(round.detail);
        if (normDetail && normSource.includes(normDetail.slice(0, 30))) {
          groundedRounds.push(round);
        }
      }
    }

    return {
      found: groundedRounds.length > 0,
      rounds: groundedRounds,
      notes: raw.notes,
    };
  } catch {
    return {
      found: false,
      rounds: [],
      notes: "Error extracting interview process.",
    };
  }
}
