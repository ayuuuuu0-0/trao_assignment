import { describe, it, expect } from "vitest";
import { Kit } from "../src/schema/kit.js";
import { validateKit } from "../src/validate/validateKit.js";

function createValidKit(): Kit {
  return {
    source: {
      company: "Acme Corp",
      company_url: "https://acme.example.com",
      role: "Senior Backend Engineer",
      location: "San Francisco, CA",
      jd_chars: 1200,
      researched_at: "2026-09-20T12:00:00Z",
      pages_used: ["https://acme.example.com/about"]
    },
    company_brief: {
      summary: "Acme Corp builds developer infrastructure tools.",
      what_they_do: "Cloud developer platforms and observability pipelines.",
      sources: ["https://acme.example.com/about"]
    },
    role: {
      title: "Senior Backend Engineer",
      seniority: "Senior",
      responsibilities: ["Architect scalable distributed systems", "Mentor junior developers"],
      requirements: [
        {
          id: "r1",
          text: "5+ years of Node.js and TypeScript experience",
          kind: "technical",
          priority: "must",
          evidence: "Requires 5+ years of Node.js and TypeScript experience"
        },
        {
          id: "r2",
          text: "Experience with distributed consensus algorithms",
          kind: "technical",
          priority: "nice",
          evidence: "Knowledge of Raft or Paxos is a plus"
        }
      ]
    },
    questions: [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "How does Node.js handle the event loop when processing microtasks versus macrotasks?",
        answer_outline: "Explain nextTick queue, promise reaction queue, timers, I/O polling, and setImmediate execution phases.",
        difficulty: 2
      },
      {
        id: "q2",
        requirement_ids: ["r2"],
        category: "technical",
        prompt: "Walk through leader election in Raft and discuss split-brain scenarios.",
        answer_outline: "Describe terms, randomized heartbeat timers, majority votes, and log replication guarantees.",
        difficulty: 3
      }
    ],
    flashcards: [
      {
        id: "f1",
        front: "Node Event Loop phases",
        back: "Timers -> Pending Callbacks -> Idle/Prepare -> Poll -> Check -> Close Callbacks",
        requirement_ids: ["r1"]
      }
    ],
    schedule: {
      days_available: 2,
      days: [
        {
          day: 1,
          focus: "Technical Core: Node.js internals",
          question_ids: ["q1"],
          minutes: 45
        },
        {
          day: 2,
          focus: "Distributed Systems & Raft Consensus",
          question_ids: ["q2"],
          minutes: 60
        }
      ]
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 1
    },
    warnings: []
  };
}

describe("validateKit", () => {
  it("passes validation on a structurally sound and consistent kit", () => {
    const kit = createValidKit();
    const result = validateKit(kit);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when a required field is missing", () => {
    const kit = createValidKit() as any;
    delete kit.company_brief.what_they_do;
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes("what_they_do"))).toBe(true);
  });

  it("fails when a question references a non-existent requirement id", () => {
    const kit = createValidKit();
    kit.questions[0].requirement_ids = ["r999"];
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "INVALID_REQUIREMENT_REFERENCE")).toBe(true);
  });

  it("fails when a flashcard references a non-existent requirement id", () => {
    const kit = createValidKit();
    kit.flashcards[0].requirement_ids = ["nonexistent_req"];
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "INVALID_REQUIREMENT_REFERENCE")).toBe(true);
  });

  it("fails when schedule days count does not match days_available", () => {
    const kit = createValidKit();
    kit.schedule.days_available = 5;
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "SCHEDULE_DAY_COUNT_MISMATCH")).toBe(true);
  });

  it("fails when schedule contains a dangling question id", () => {
    const kit = createValidKit();
    kit.schedule.days[0].question_ids = ["q_does_not_exist"];
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "INVALID_QUESTION_REFERENCE")).toBe(true);
  });

  it("fails when schedule day minutes is a floating point number", () => {
    const kit = createValidKit() as any;
    kit.schedule.days[0].minutes = 45.5;
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes("minutes"))).toBe(true);
  });

  it("fails when question difficulty is out of range", () => {
    const kit = createValidKit() as any;
    kit.questions[0].difficulty = 4;
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes("difficulty"))).toBe(true);
  });

  it("fails when requirement priority is invalid", () => {
    const kit = createValidKit() as any;
    kit.role.requirements[0].priority = "critical";
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes("priority"))).toBe(true);
  });

  it("fails when requirement ids contain duplicates", () => {
    const kit = createValidKit();
    kit.role.requirements.push({
      id: "r1",
      text: "Duplicate requirement id",
      kind: "technical",
      priority: "nice"
    });
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "DUPLICATE_REQUIREMENT_ID")).toBe(true);
  });

  it("fails when a must-have requirement is not covered by any scheduled question", () => {
    const kit = createValidKit();
    kit.schedule.days[0].question_ids = [];
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "UNCOVERED_MUST_REQUIREMENT")).toBe(true);
  });
});
