import { describe, it, expect } from "vitest";
import { planQuestions } from "../src/steps/planQuestions.js";
import { generateAllQuestions } from "../src/steps/generateQuestions.js";
import { generateFlashcards, deriveFlashcardsFromQuestions } from "../src/steps/generateFlashcards.js";
import { FakeLlmClient } from "../src/llm/fakeLlmClient.js";
import { Role, CompanyBrief, ProcessRecord, Kit } from "../src/schema/kit.js";

function makeRole(senior = true): Role {
  return {
    title: senior ? "Senior Backend Engineer" : "Junior Developer",
    seniority: senior ? "Senior" : "Junior",
    responsibilities: ["Scale systems"],
    requirements: [
      { id: "r1", text: "Node.js", kind: "technical", priority: "must" },
      { id: "r2", text: "PostgreSQL", kind: "technical", priority: "must" },
      { id: "r3", text: "Mentoring", kind: "behavioural", priority: "must" },
    ],
  };
}

function makeBrief(hasSources = true): CompanyBrief {
  return {
    summary: "Cloud company.",
    what_they_do: "Dev tools.",
    sources: hasSources ? ["https://acme.com/about"] : [],
    edited_fields: [],
  };
}

function makeProcess(hasSysDesign = false): ProcessRecord {
  return {
    found: hasSysDesign,
    rounds: hasSysDesign
      ? [{ name: "SysDesign", format: "system-design", detail: "Architecture round" }]
      : [],
  };
}

function makeBaseKit(): Kit {
  return {
    source: {
      company: "Acme",
      company_url: "https://acme.com",
      role: "Senior Backend Engineer",
      location: "Remote",
      jd_chars: 1000,
      researched_at: "2026-09-22T00:00:00Z",
      pages_used: [],
    },
    company_brief: makeBrief(),
    role: makeRole(),
    questions: [],
    flashcards: [],
    schedule: { days: [] },
    coverage: {
      must_have_count: 3,
      covered_must_haves: 0,
      uncovered_requirement_ids: ["r1", "r2", "r3"],
      passes: 0,
    },
    id_counters: { r: 3, q: 0, f: 0 },
  };
}

describe("planQuestions", () => {
  it("computes counts and includes system design for senior roles", () => {
    const plan = planQuestions(makeRole(true), makeProcess(false), makeBrief(true));
    expect(plan.technical).toBeGreaterThanOrEqual(4); // 2 musts * 2 = 4
    expect(plan.behavioural).toBeGreaterThanOrEqual(2);
    expect(plan["system-design"]).toBe(3); // Senior role with tech must
    expect(plan["company-fit"]).toBe(3); // Sources present
  });

  it("skips system design for junior roles with no system design round", () => {
    const plan = planQuestions(makeRole(false), makeProcess(false), makeBrief(false));
    expect(plan["system-design"]).toBe(0);
    expect(plan["company-fit"]).toBe(2);
  });
});

describe("generateAllQuestions", () => {
  it("calls categories, assigns sequential IDs, and filters invalid requirement IDs", async () => {
    const fakeClient = new FakeLlmClient((prompt) => {
      const step = prompt.stepName;
      if (step?.includes("technical")) {
        return {
          questions: [
            {
              prompt: "Explain Node streams",
              answer_outline: "Readable, Writable, Transform",
              difficulty: 2,
              requirement_ids: ["r1", "hallucinated_r99"],
            },
          ],
        };
      }
      if (step?.includes("behavioural")) {
        return {
          questions: [
            {
              prompt: "Tell me about mentoring",
              answer_outline: "STAR response",
              difficulty: 2,
              requirement_ids: ["r3"],
            },
          ],
        };
      }
      if (step?.includes("company-fit")) {
        return {
          questions: [
            {
              prompt: "Why Acme?",
              answer_outline: "Dev tools mission",
              difficulty: 1,
              requirement_ids: [],
            },
          ],
        };
      }
      return { questions: [] };
    });

    const plan = {
      technical: 1,
      behavioural: 1,
      "system-design": 0,
      "company-fit": 1,
    };

    const { questions, updatedKit } = await generateAllQuestions(
      makeRole(),
      makeBrief(),
      makeProcess(),
      plan,
      fakeClient,
      makeBaseKit()
    );

    expect(questions.length).toBe(3);
    // Sequential IDs
    expect(questions[0].id).toBe("q1");
    expect(questions[1].id).toBe("q2");
    expect(questions[2].id).toBe("q3");

    // Hallucinated ID filtered out from q1
    expect(questions[0].requirement_ids).toEqual(["r1"]);
    expect(questions[0].requirement_ids).not.toContain("hallucinated_r99");

    // Counter updated in kit
    expect(updatedKit.id_counters?.q).toBe(3);
  });
});

describe("generateFlashcards", () => {
  it("derives flashcards deterministically if model call fails", async () => {
    const failingClient = new FakeLlmClient(() => {
      throw new Error("Model unavailable");
    });

    const questions = [
      {
        id: "q1",
        category: "technical" as const,
        prompt: "What is the event loop?",
        answer_outline: "Single threaded asynchronous event queue mechanism.",
        difficulty: 2,
        requirement_ids: ["r1"],
      },
    ];

    const result = await generateFlashcards(
      questions,
      makeRole().requirements,
      failingClient,
      makeBaseKit()
    );

    expect(result.flashcards.length).toBe(1);
    expect(result.flashcards[0].front).toBe("What is the event loop?");
    expect(result.flashcards[0].origin).toBe("fallback");
    expect(result.warnings.some((w) => w.code === "FLASHCARDS_DERIVED")).toBe(true);
  });
});
