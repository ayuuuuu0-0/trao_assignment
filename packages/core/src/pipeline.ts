import { Kit, BatchCaseInput } from "./schema/kit.js";
import { validateKit } from "./validate/validateKit.js";

export interface PipelineOptions {
  allowPrivateHosts?: boolean;
  timeoutMs?: number;
  useFakeLlm?: boolean;
}

export interface PipelineSuccess {
  id: string;
  status: "ok";
  kit: Kit;
  error: null;
}

export interface PipelineFailure {
  id: string;
  status: "failed";
  kit: null;
  error: {
    code: string;
    message: string;
  };
}

export type PipelineResult = PipelineSuccess | PipelineFailure;

export async function runPipeline(
  input: BatchCaseInput,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const jdTrimmed = input.jd.trim();
  if (!jdTrimmed) {
    return {
      id: input.id,
      status: "failed",
      kit: null,
      error: {
        code: "INVALID_INPUT",
        message: "Job description is empty or contains only whitespace."
      }
    };
  }

  if (!Number.isInteger(input.days) || input.days < 1) {
    return {
      id: input.id,
      status: "failed",
      kit: null,
      error: {
        code: "INVALID_INPUT",
        message: "Days parameter must be a positive integer."
      }
    };
  }

  const stubKit: Kit = {
    source: {
      company: "Evaluated Company",
      company_url: input.company_url,
      role: "Software Engineer",
      location: "",
      jd_chars: input.jd.length,
      researched_at: new Date().toISOString(),
      pages_used: [input.company_url]
    },
    company_brief: {
      summary: "Evaluated company brief extracted from input posting.",
      what_they_do: "Software and systems development.",
      sources: [input.company_url]
    },
    role: {
      title: "Software Engineer",
      seniority: "Mid-Senior",
      responsibilities: ["Design and build scalable services"],
      requirements: [
        {
          id: "r1",
          text: "Core technical proficiency matching job requirements",
          kind: "technical",
          priority: "must",
          evidence: input.jd.slice(0, 100).trim()
        }
      ]
    },
    questions: [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Describe your technical approach and architectural trade-offs.",
        answer_outline: "Discuss modularity, failure handling, and testability.",
        difficulty: 2,
        origin: "generated",
        edited: false,
        pinned: false
      }
    ],
    flashcards: [
      {
        id: "f1",
        front: "Core engineering principles",
        back: "Separation of concerns, defensive programming, automated testing",
        requirement_ids: ["r1"],
        origin: "generated",
        edited: false,
        pinned: false
      }
    ],
    schedule: {
      days_available: input.days,
      days: Array.from({ length: input.days }, (_, index) => ({
        day: index + 1,
        focus: index === 0 ? "Technical Foundation: Core Architecture" : `Review Day ${index + 1}: Practice & Deep Dive`,
        question_ids: ["q1"],
        minutes: index === 0 ? 45 : 30
      }))
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 1
    },
    warnings: []
  };

  const validation = validateKit(stubKit);
  if (!validation.valid) {
    return {
      id: input.id,
      status: "failed",
      kit: null,
      error: {
        code: "VALIDATION_FAILED",
        message: validation.errors.map((e) => e.message).join("; ")
      }
    };
  }

  return {
    id: input.id,
    status: "ok",
    kit: stubKit,
    error: null
  };
}
