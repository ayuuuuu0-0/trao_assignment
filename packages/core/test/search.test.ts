import { describe, it, expect } from "vitest";
import {
  cleanHnText,
  filterRelevantHit,
  searchDiscussion,
  AlgoliaHit,
} from "../src/retrieval/search.js";

describe("cleanHnText", () => {
  it("strips HTML tags and unescapes entities", () => {
    const raw = "<p>I interviewed at &quot;Acme&quot; &amp; had a &#39;great&#39; screen.</p>";
    expect(cleanHnText(raw)).toBe("I interviewed at \"Acme\" & had a 'great' screen.");
  });

  it("collapses whitespace", () => {
    const raw = "Lots   of \n\n  whitespace\t here.";
    expect(cleanHnText(raw)).toBe("Lots of whitespace here.");
  });
});

describe("filterRelevantHit", () => {
  it("accepts hits mentioning both company and interview keywords", () => {
    const hit: AlgoliaHit = {
      objectID: "101",
      title: "Ask HN: How is the Stripe interview process?",
      story_text: "I recently did a technical screen with Stripe.",
    };
    const result = filterRelevantHit("Stripe", hit);
    expect(result).not.toBeNull();
    expect(result?.title).toBe("Ask HN: How is the Stripe interview process?");
    expect(result?.url).toBe("https://news.ycombinator.com/item?id=101");
    expect(result?.snippet).toContain("technical screen");
  });


  it("rejects hits that mention company but no interview keywords", () => {
    const hit: AlgoliaHit = {
      objectID: "102",
      title: "Stripe launches new payment feature",
      story_text: "Today Stripe announced automated tax handling.",
    };
    expect(filterRelevantHit("Stripe", hit)).toBeNull();
  });

  it("rejects hits that mention interview keywords but not the target company", () => {
    const hit: AlgoliaHit = {
      objectID: "103",
      title: "My interview experience at Google",
      story_text: "The technical screen involved graphs.",
    };
    expect(filterRelevantHit("Stripe", hit)).toBeNull();
  });

  it("truncates snippets to 800 characters", () => {
    const longText = "Stripe interview: " + "A".repeat(1200);
    const hit: AlgoliaHit = {
      objectID: "104",
      title: "Stripe interview thoughts",
      story_text: longText,
    };
    const result = filterRelevantHit("Stripe", hit);
    expect(result).not.toBeNull();
    expect(result?.snippet.length).toBeLessThanOrEqual(800);
  });
});

describe("searchDiscussion", () => {
  it("returns none_found for empty or whitespace company name", async () => {
    const result = await searchDiscussion("   ");
    expect(result.status).toBe("none_found");
    expect(result.sources).toEqual([]);
  });

  it("returns found and gathers matching sources from injected fetch", async () => {
    const mockHits: AlgoliaHit[] = [
      {
        objectID: "1",
        title: "Acme interview experience",
        comment_text: "I did an onsite screen at Acme last month.",
      },
      {
        objectID: "2",
        title: "Unrelated news",
        comment_text: "Nothing about jobs here.",
      },
      {
        objectID: "3",
        title: "Acme hiring process update",
        comment_text: "The take-home challenge for Acme took 4 hours.",
      },
    ];

    const mockFetch = async () =>
      new Response(JSON.stringify({ hits: mockHits }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const result = await searchDiscussion("Acme", mockFetch as unknown as typeof fetch);
    expect(result.status).toBe("found");
    expect(result.sources.length).toBe(2);
    expect(result.sources[0].title).toBe("Acme interview experience");
    expect(result.sources[1].title).toBe("Acme hiring process update");
  });

  it("returns none_found when hits list is empty", async () => {
    const mockFetch = async () =>
      new Response(JSON.stringify({ hits: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const result = await searchDiscussion("FictionalCorp", mockFetch as unknown as typeof fetch);
    expect(result.status).toBe("none_found");
    expect(result.sources).toEqual([]);
  });

  it("returns none_found when hits do not match relevance filter", async () => {
    const mockHits: AlgoliaHit[] = [
      {
        objectID: "55",
        title: "General market discussion",
        comment_text: "Tech stocks were volatile today.",
      },
    ];

    const mockFetch = async () =>
      new Response(JSON.stringify({ hits: mockHits }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const result = await searchDiscussion("Acme", mockFetch as unknown as typeof fetch);
    expect(result.status).toBe("none_found");
    expect(result.sources).toEqual([]);
  });

  it("caps results at 5 sources", async () => {
    const mockHits: AlgoliaHit[] = Array.from({ length: 10 }, (_, i) => ({
      objectID: String(i + 1),
      title: `Acme interview note ${i + 1}`,
      comment_text: `Interview details for Acme stage ${i + 1}`,
    }));

    const mockFetch = async () =>
      new Response(JSON.stringify({ hits: mockHits }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const result = await searchDiscussion("Acme", mockFetch as unknown as typeof fetch);
    expect(result.status).toBe("found");
    expect(result.sources.length).toBe(5);
  });

  it("returns failed when network call errors out, without throwing", async () => {
    const mockFetch = async () => {
      throw new Error("DNS resolution failed");
    };

    const result = await searchDiscussion("Acme", mockFetch as unknown as typeof fetch);
    expect(result.status).toBe("failed");
    expect(result.sources).toEqual([]);
    expect(result.error).toContain("HN search failed");
  });
});
