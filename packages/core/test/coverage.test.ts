import { describe, it, expect } from "vitest";
import { checkCoverage } from "../src/coverage/checkCoverage.js";
import { runCoverageLoop } from "../src/coverage/coverageLoop.js";
import { FakeLlmClient } from "../src/llm/fakeLlmClient.js";
import { Requirement, Question, Kit } from "../src/schema/kit.js";

function makeRequirements(): Requirement[] {
  return [
    { id: "r1", text: "TypeScript and Node.js", kind: "technical", priority: "must" },
    { id: "r2", text: "PostgreSQL database", kind: "technical", priority: "must" },
    { id: "r3", text: "Kubernetes orchestration", kind: "technical", priority: "nice" },
  ];
}

function makeBaseKit(): Kit {
  return {
    source: {
      company: "Acme",
      company_url: "https://acme.com",
      role: "Backend",
      location: "Remote",
      jd_chars: 500,
      researched_at: "2026-09-22T00:00:00Z",
      pages_used: [],
    },
    company_brief: { summary: "", what_they_do: "", sources: [], edited_fields: [] },
    role: { title: "Backend", seniority: "Mid", responsibilities: [], requirements: makeRequirements() },
    questions: [],
    flashcards: [],
    schedule: { days: [] },
    coverage: { must_have_count: 2, covered_must_haves: 0, uncovered_requirement_ids: [], passes: 0 },
    id_counters: { r: 3, q: 0, f: 0 },
  };
}

describe("checkCoverage - Pure Function", () => {
  it("reports zero gaps when all requirements are covered", () => {
    const reqs = makeRequirements();
    const questions: Question[] = [
      {
        id: "q1",
        category: "technical",
        prompt: "TS questions",
        answer_outline: "Outline",
        difficulty: 2,
        requirement_ids: ["r1", "r2", "r3"],
      },
    ];

    const result = checkCoverage(reqs, questions);
    expect(result.uncovered).toEqual([]);
    expect(result.uncoveredMust).toEqual([]);
    expect(result.coveredMustCount).toBe(2);
    expect(result.totalMustCount).toBe(2);
  });

  it("identifies uncovered must-haves versus nice-to-haves", () => {
    const reqs = makeRequirements();
    // Only covers r3 (nice)
    const questions: Question[] = [
      {
        id: "q1",
        category: "technical",
        prompt: "K8s questions",
        answer_outline: "Outline",
        difficulty: 2,
        requirement_ids: ["r3"],
      },
    ];

    const result = checkCoverage(reqs, questions);
    expect(result.uncovered).toEqual(["r1", "r2"]);
    expect(result.uncoveredMust).toEqual(["r1", "r2"]);
    expect(result.coveredMustCount).toBe(0);
    expect(result.totalMustCount).toBe(2);
  });
});

describe("runCoverageLoop", () => {
  it("closes an uncovered requirement gap via repair call", async () => {
    const reqs = makeRequirements();
    // Initial question only covers r1
    const initialQuestions: Question[] = [
      {
        id: "q1",
        category: "technical",
        prompt: "Node.js question",
        answer_outline: "Outline",
        difficulty: 2,
        requirement_ids: ["r1"],
      },
    ];

    // Repair client provides questions for r2 and r3
    const repairClient = new FakeLlmClient((prompt) => {
      return {
        questions: [
          {
            prompt: "PostgreSQL question",
            answer_outline: "Outline",
            difficulty: 2,
            requirement_ids: ["r2"],
          },
        ],
      };
    });

    const result = await runCoverageLoop(
      reqs,
      initialQuestions,
      repairClient,
      makeBaseKit()
    );

    // r2 gap was closed by the repair pass
    expect(result.questions.some((q) => q.requirement_ids.includes("r2"))).toBe(true);
    const check = checkCoverage(reqs, result.questions);
    expect(check.coveredMustCount).toBe(2);
    expect(check.uncoveredMust.length).toBe(0);
    expect(result.coverage.passes).toBeGreaterThanOrEqual(2);
  });

  it("adds deterministic fallback question if must-have remains uncovered after repairs", async () => {
    const reqs = makeRequirements();
    // Stubborn failing client that returns invalid/empty questions
    const stubbornClient = new FakeLlmClient(() => {
      return { questions: [] };
    });

    // Initial question covers none of the requirements
    const result = await runCoverageLoop(
      reqs,
      [],
      stubbornClient,
      makeBaseKit()
    );

    // Both must-haves r1 and r2 received deterministic fallback questions
    const fallbacks = result.questions.filter((q) => q.origin === "fallback");
    expect(fallbacks.length).toBe(2);
    expect(fallbacks[0].prompt).toContain("Describe your experience with: TypeScript and Node.js");
    expect(fallbacks[1].prompt).toContain("Describe your experience with: PostgreSQL database");

    // All must-haves are 100% covered
    const check = checkCoverage(reqs, result.questions);
    expect(check.coveredMustCount).toBe(2);
    expect(check.uncoveredMust.length).toBe(0);
    expect(result.warnings.some((w) => w.code === "MUST_COVERAGE_FALLBACK")).toBe(true);
  });
});
