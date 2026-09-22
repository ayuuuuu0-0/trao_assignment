import { describe, it, expect } from "vitest";
import { extractProcess } from "../src/steps/extractProcess.js";
import { FakeLlmClient } from "../src/llm/fakeLlmClient.js";
import { CrawledPage } from "../src/retrieval/crawler.js";
import { DiscussionSource } from "../src/schema/kit.js";

describe("extractProcess", () => {
  it("makes zero model calls when no hiring text or discussion is present", async () => {
    let callCount = 0;
    const client = new FakeLlmClient(async () => {
      callCount++;
      return { found: false, rounds: [] };
    });

    const process = await extractProcess([], [], undefined, client);

    expect(callCount).toBe(0);
    expect(process.found).toBe(false);
    expect(process.rounds).toEqual([]);
  });

  it("extracts structured rounds when hiring page content is provided", async () => {
    let callCount = 0;
    const client = new FakeLlmClient(async () => {
      callCount++;
      return {
        found: true,
        rounds: [
          {
            name: "Take-Home Assignment",
            format: "take-home",
            detail: "Build a microservice in 3 days",
            evidence: "take-home project to build a small service",
            source_url: "https://acme.com/jobs/process",
          },
          {
            name: "System Architecture",
            format: "system-design",
            detail: "Virtual onsite design screen",
            evidence: "virtual onsite design session with a principal engineer",
            source_url: "https://acme.com/jobs/process",
          },
        ],
      };
    });

    const pages: CrawledPage[] = [
      {
        url: "https://acme.com/jobs/process",
        kind: "hiring",
        status: "fetched",
        text: "Our hiring process includes a take-home project to build a small service, followed by a virtual onsite design session with a principal engineer.",
      },
    ];

    const result = await extractProcess(pages, [], undefined, client);

    expect(callCount).toBe(1);
    expect(result.found).toBe(true);
    expect(result.rounds.length).toBe(2);
    expect(result.rounds[0].format).toBe("take-home");
    expect(result.rounds[1].format).toBe("system-design");
  });

  it("drops rounds whose evidence is not grounded in source text", async () => {
    const client = new FakeLlmClient(async () => {
      return {
        found: true,
        rounds: [
          {
            name: "Real Screen",
            format: "screen",
            detail: "Phone call with recruiter",
            evidence: "30-minute phone chat with recruiter",
          },
          {
            name: "Hallucinated Round",
            format: "coding",
            detail: "LeetCode hard dynamic programming",
            evidence: "Live 3-hour whiteboard LeetCode marathon", // NOT IN SOURCE
          },
        ],
      };
    });

    const pages: CrawledPage[] = [
      {
        url: "https://acme.com/jobs",
        kind: "hiring",
        status: "fetched",
        text: "We start with a 30-minute phone chat with recruiter to discuss your background and goals.",
      },
    ];

    const result = await extractProcess(pages, [], undefined, client);

    // Only the grounded round survives
    expect(result.rounds.length).toBe(1);
    expect(result.rounds[0].name).toBe("Real Screen");
  });
});
