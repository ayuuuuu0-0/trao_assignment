import { describe, it, expect } from "vitest";
import { runPipeline } from "../src/pipeline.js";
import { FakeLlmClient } from "../src/llm/fakeLlmClient.js";
import { validateKit } from "../src/validate/validateKit.js";

const mockEmptyFetch = async () =>
  new Response(JSON.stringify({ hits: [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

describe("runPipeline", () => {
  it("rejects empty job description", async () => {
    const res = await runPipeline({
      id: "case-empty",
      jd: "   ",
      company_url: "https://example.com",
      days: 5,
    });

    expect(res.status).toBe("failed");
    expect(res.error?.code).toBe("INVALID_INPUT");
    expect(res.kit).toBeNull();
  });

  it("rejects invalid days parameter", async () => {
    const res = await runPipeline({
      id: "case-invalid-days",
      jd: "Valid job description for a software engineer role.",
      company_url: "https://example.com",
      days: -1,
    });

    expect(res.status).toBe("failed");
    expect(res.error?.code).toBe("INVALID_INPUT");
    expect(res.kit).toBeNull();
  });

  it("executes full end-to-end pipeline with fake LLM and produces schema-valid Kit", async () => {
    const sampleJd = `
Senior Software Engineer at NexusAI
Location: Remote

Responsibilities:
- Build and maintain resilient backend services.
- Architect high-throughput distributed systems.

Requirements:
- Strong proficiency in TypeScript and Node.js (required).
- Production experience with PostgreSQL and database schema migrations (required).
- Knowledge of Kubernetes and container orchestration (nice to have).
- Mentorship and collaborative communication (essential).
`;

    const fakeClient = new FakeLlmClient((prompt) => {
      const step = prompt.stepName ?? "";

      if (step.includes("extract-requirements") || prompt.user.includes("Extract requirements")) {
        return {
          title: "Senior Software Engineer",
          seniority: "Senior",
          location: "Remote",
          company: "NexusAI",
          responsibilities: [
            "Build and maintain resilient backend services",
            "Architect high-throughput distributed systems",
          ],
          requirements: [
            {
              text: "Strong proficiency in TypeScript and Node.js",
              kind: "technical",
              priority: "must",
              evidence: "Strong proficiency in TypeScript and Node.js (required).",
            },
            {
              text: "Production experience with PostgreSQL and database schema migrations",
              kind: "technical",
              priority: "must",
              evidence: "Production experience with PostgreSQL and database schema migrations (required).",
            },
            {
              text: "Knowledge of Kubernetes and container orchestration",
              kind: "technical",
              priority: "nice",
              evidence: "Knowledge of Kubernetes and container orchestration (nice to have).",
            },
            {
              text: "Mentorship and collaborative communication",
              kind: "behavioural",
              priority: "must",
              evidence: "Mentorship and collaborative communication (essential).",
            },
          ],
        };
      }

      if (step.includes("company-brief")) {
        return {
          summary: "NexusAI develops modern AI systems and cloud backend services.",
          what_they_do: "AI platforms and developer APIs.",
        };
      }

      if (step.includes("extract-process")) {
        return {
          found: true,
          rounds: [
            {
              name: "Technical Deep-Dive",
              format: "coding",
              detail: "Coding assessment in TypeScript",
              evidence: "Technical Deep-Dive coding assessment",
            },
          ],
        };
      }

      if (step.startsWith("generate-questions")) {
        return {
          questions: [
            {
              prompt: "How do you structure microservices in TypeScript to ensure resilience and maintainability?",
              answer_outline: "Discuss modular architecture, strict typing, error boundaries, and integration testing.",
              difficulty: 2,
              requirement_ids: ["r1"],
            },
            {
              prompt: "Walk through your strategy for running zero-downtime PostgreSQL schema migrations under heavy load.",
              answer_outline: "Explain expand-contract pattern, safe indexing with CONCURRENTLY, and lock timeouts.",
              difficulty: 3,
              requirement_ids: ["r2"],
            },
            {
              prompt: "Describe an incident where you mentored an engineer or steered team consensus on an architecture choice.",
              answer_outline: "STAR response detailing guidance, technical trade-offs evaluated, and team impact.",
              difficulty: 2,
              requirement_ids: ["r4"],
            },
          ],
        };
      }

      if (step.includes("generate-flashcards")) {
        return {
          flashcards: [
            {
              front: "Expand-Contract Pattern",
              back: "A zero-downtime database migration technique making backward-compatible changes across separate deployments.",
              requirement_ids: ["r2"],
            },
          ],
        };
      }

      if (step.startsWith("coverage-repair")) {
        return { questions: [] };
      }

      return {};
    });

    const res = await runPipeline(
      {
        id: "case-nexus-1",
        jd: sampleJd,
        company_url: "https://nexusai.example.internal",
        days: 3,
      },
      {
        llmClient: fakeClient,
        fetchFn: mockEmptyFetch as unknown as typeof fetch,
        crawledPages: [
          {
            url: "https://nexusai.example.internal/about",
            kind: "about",
            status: "fetched",
            title: "About NexusAI",
            text: "NexusAI is a fast-growing artificial intelligence platform powering modern enterprise engineering teams.",
          },
        ],
      }
    );

    expect(res.status).toBe("ok");
    expect(res.error).toBeNull();
    expect(res.kit).not.toBeNull();

    const kit = res.kit!;

    // 1. Structure validation
    const validation = validateKit(kit);
    expect(validation.valid).toBe(true);

    // 2. Metadata
    expect(kit.source.company).toBe("NexusAI");
    expect(kit.source.role).toBe("Senior Software Engineer");
    expect(kit.role.requirements.length).toBe(4);

    // 3. Schedule conformance
    expect(kit.schedule.days_available).toBe(3);
    expect(kit.schedule.days.length).toBe(3);
    expect(kit.schedule.days.every((d) => d.minutes > 0)).toBe(true);

    // 4. Coverage guarantee: all must-haves are covered
    const mustIds = kit.role.requirements.filter((r) => r.priority === "must").map((r) => r.id);
    const coveredReqIds = new Set(kit.questions.flatMap((q) => q.requirement_ids));
    for (const mustId of mustIds) {
      expect(coveredReqIds.has(mustId)).toBe(true);
    }
  });

  it("handles unreachable/dead company URL gracefully without crashing", async () => {
    const sampleJd = `
Full Stack Developer
We are looking for a JavaScript and React developer to build web tools.
Required: JavaScript and React experience.
`;

    const res = await runPipeline(
      {
        id: "case-dead-url",
        jd: sampleJd,
        company_url: "https://invalid-non-existent-domain-999.test",
        days: 2,
      },
      {
        useFakeLlm: true,
        fetchFn: mockEmptyFetch as unknown as typeof fetch,
        crawledPages: [],
      }
    );

    expect(res.status).toBe("ok");
    expect(res.kit).not.toBeNull();

    const kit = res.kit!;
    const validation = validateKit(kit);
    expect(validation.valid).toBe(true);

    // Brief honestly reflects that no information could be retrieved
    expect(kit.company_brief.what_they_do).toBe("Not found.");
    expect(kit.schedule.days.length).toBe(2);
  });

  it("handles thin two-line job description and records warning", async () => {
    const thinJd = "Junior Engineer\nMust know Python and git.";

    const res = await runPipeline(
      {
        id: "case-thin-jd",
        jd: thinJd,
        company_url: "https://example.com",
        days: 1,
      },
      {
        useFakeLlm: true,
        fetchFn: mockEmptyFetch as unknown as typeof fetch,
        crawledPages: [],
      }
    );

    expect(res.status).toBe("ok");
    expect(res.kit).not.toBeNull();

    const kit = res.kit!;
    const validation = validateKit(kit);
    expect(validation.valid).toBe(true);

    // Single day schedule has 1 day
    expect(kit.schedule.days.length).toBe(1);
    expect(kit.schedule.days[0].day).toBe(1);
  });
});
