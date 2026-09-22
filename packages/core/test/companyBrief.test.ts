import { describe, it, expect } from "vitest";
import { extractCompanyBrief } from "../src/steps/companyBrief.js";
import { FakeLlmClient } from "../src/llm/fakeLlmClient.js";
import { CrawledPage } from "../src/retrieval/crawler.js";

describe("extractCompanyBrief", () => {
  it("makes zero model calls when usable text is under 200 characters", async () => {
    let callCount = 0;
    const client = new FakeLlmClient(async () => {
      callCount++;
      return { summary: "Foo", what_they_do: "Bar" };
    });

    const pages: CrawledPage[] = [
      {
        url: "https://acme.com/about",
        kind: "about",
        status: "fetched",
        text: "Brief text.", // < 200 chars
      },
    ];

    const brief = await extractCompanyBrief(
      "https://acme.com",
      "Acme",
      pages,
      "JD text",
      client
    );

    expect(callCount).toBe(0);
    expect(brief.summary).toContain("No information about Acme could be retrieved");
    expect(brief.what_they_do).toBe("Not found.");
    expect(brief.sources).toEqual([]);
  });

  it("calls model and populates brief when usable text exceeds 200 characters", async () => {
    let callCount = 0;
    const client = new FakeLlmClient(async () => {
      callCount++;
      return {
        summary: "Acme Corp is an enterprise cloud computing company.",
        what_they_do: "High-performance database infrastructure.",
      };
    });

    const longText = "About Acme: We provide global enterprise cloud solutions. ".repeat(6);
    const pages: CrawledPage[] = [
      {
        url: "https://acme.com/about",
        kind: "about",
        status: "fetched",
        text: longText,
      },
    ];

    const brief = await extractCompanyBrief(
      "https://acme.com",
      "Acme",
      pages,
      "JD text",
      client
    );

    expect(callCount).toBe(1);
    expect(brief.summary).toBe("Acme Corp is an enterprise cloud computing company.");
    expect(brief.what_they_do).toBe("High-performance database infrastructure.");
    expect(brief.sources).toEqual(["https://acme.com/about"]);
  });

  it("degrades gracefully to honest brief if model call fails", async () => {
    const client = new FakeLlmClient(async () => {
      throw new Error("Model timeout");
    });

    const longText = "About Acme: We provide global enterprise cloud solutions. ".repeat(6);
    const pages: CrawledPage[] = [
      {
        url: "https://acme.com/about",
        kind: "about",
        status: "fetched",
        text: longText,
      },
    ];

    const brief = await extractCompanyBrief(
      "https://acme.com",
      "Acme",
      pages,
      "JD text",
      client
    );

    expect(brief.summary).toContain("No information about Acme could be retrieved");
  });
});
