import { z } from "zod";
import { CompanyBrief } from "../schema/kit.js";
import { ILlmClient } from "../llm/types.js";
import { wrapUntrusted, UNTRUSTED_DATA_SYSTEM_INSTRUCTION } from "../llm/wrapUntrusted.js";
import { CrawledPage } from "../retrieval/crawler.js";

export const CompanyBriefOutputSchema = z.object({
  summary: z.string(),
  what_they_do: z.string(),
});

const BRIEF_SYSTEM_PROMPT = `${UNTRUSTED_DATA_SYSTEM_INSTRUCTION}

You are an expert research analyst writing a factual company brief for a job candidate.
Rules:
1. "summary": Up to 120 words summarizing the company background, mission, and scale.
2. "what_they_do": Up to 80 words explaining their core product, service, or offering.
3. Every single statement must be grounded strictly in the provided text. Never invent facts, founding dates, or capabilities not explicitly stated.
4. If a piece of information is unknown or unmentioned, simply omit it.`;

export async function extractCompanyBrief(
  companyUrl: string,
  companyName: string,
  pages: CrawledPage[],
  jdText: string,
  llmClient: ILlmClient
): Promise<CompanyBrief> {
  const usablePages = pages.filter(
    (p) => p.status === "fetched" && (p.kind === "about" || p.kind === "other") && (p.text?.trim().length ?? 0) > 0
  );

  const combinedPageText = usablePages
    .map((p) => `Page (${p.url}):\n${p.text}`)
    .join("\n\n")
    .slice(0, 15_000); // cap to prompt budget

  const totalUsableLength = combinedPageText.trim().length;

  // Zero-call honest brief if usable text is thin (< 200 characters)
  if (totalUsableLength < 200) {
    const fallbackName = companyName.trim() || "this company";
    return {
      summary: `No information about ${fallbackName} could be retrieved from ${companyUrl}.`,
      what_they_do: "Not found.",
      sources: [],
      edited_fields: [],
    };
  }

  const userPrompt = `Generate a concise company brief for "${companyName}" based strictly on the following text:

${wrapUntrusted("company-pages", combinedPageText)}`;

  try {
    const output = await llmClient.generateJson(
      {
        system: BRIEF_SYSTEM_PROMPT,
        user: userPrompt,
        stepName: "company-brief",
      },
      CompanyBriefOutputSchema
    );

    return {
      summary: output.summary.trim(),
      what_they_do: output.what_they_do.trim(),
      sources: usablePages.map((p) => p.url),
      edited_fields: [],
    };
  } catch {
    // Graceful fallback to honest brief if LLM fails
    const fallbackName = companyName.trim() || "this company";
    return {
      summary: `No information about ${fallbackName} could be retrieved from ${companyUrl}.`,
      what_they_do: "Not found.",
      sources: [],
      edited_fields: [],
    };
  }
}
