import { Kit, BatchCaseInput, Warning, Requirement } from "./schema/kit.js";
import { validateKit } from "./validate/validateKit.js";
import { ILlmClient } from "./llm/types.js";
import { MultiProviderLlmClient, loadProvidersFromEnv } from "./llm/llmClient.js";
import { FakeLlmClient } from "./llm/fakeLlmClient.js";
import { crawlSite, CrawledPage, CrawlResult } from "./retrieval/crawler.js";
import { searchDiscussion } from "./retrieval/search.js";
import { extractRequirements } from "./steps/extractRequirements.js";
import { extractCompanyBrief } from "./steps/companyBrief.js";
import { extractProcess } from "./steps/extractProcess.js";
import { planQuestions } from "./steps/planQuestions.js";
import { generateAllQuestions } from "./steps/generateQuestions.js";
import { generateFlashcards } from "./steps/generateFlashcards.js";
import { runCoverageLoop } from "./coverage/coverageLoop.js";
import { allocateSchedule } from "./schedule/allocate.js";

export interface PipelineOptions {
  allowPrivateHosts?: boolean;
  timeoutMs?: number;
  useFakeLlm?: boolean;
  llmClient?: ILlmClient;
  customCacheDir?: string;
  crawlMaxPages?: number;
  crawledPages?: CrawledPage[];
  fetchFn?: typeof fetch;
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

/**
 * Creates a deterministic fake LLM client for offline test runs or when fake LLM is requested.
 */
export function createDefaultFakeLlmClient(jd: string): ILlmClient {
  return new FakeLlmClient((prompt) => {
    const step = prompt.stepName ?? "";

    if (step.includes("extract-requirements") || prompt.user.includes("Extract requirements")) {
      const snippet = jd.slice(0, 100).trim() || "Technical role requirements";
      return {
        title: "Software Engineer",
        seniority: "Mid-Senior",
        location: "Remote",
        company: "Target Company",
        responsibilities: [
          "Design and implement reliable software services",
          "Collaborate across cross-functional engineering teams",
        ],
        requirements: [
          {
            text: "Core software engineering and architecture proficiency",
            kind: "technical",
            priority: "must",
            evidence: snippet,
          },
          {
            text: "Database design, indexing, and data modelling",
            kind: "technical",
            priority: "must",
            evidence: snippet,
          },
          {
            text: "Effective written and verbal communication",
            kind: "behavioural",
            priority: "nice",
            evidence: snippet,
          },
        ],
      };
    }

    if (step.includes("company-brief") || prompt.user.includes("company brief")) {
      return {
        summary: "Target Company builds high-performance technology solutions.",
        what_they_do: "Cloud-native distributed systems and engineering tools.",
      };
    }

    if (step.includes("extract-process") || prompt.user.includes("interview stages")) {
      return {
        found: false,
        rounds: [],
      };
    }

    if (step.startsWith("generate-questions")) {
      return {
        questions: [
          {
            prompt: "Describe your approach to designing resilient backend services and handling database migrations.",
            answer_outline: "Discuss connection pooling, isolation levels, circuit breakers, and zero-downtime schemas.",
            difficulty: 2,
            requirement_ids: ["r1", "r2"],
          },
          {
            prompt: "Tell me about a time you resolved technical disagreements regarding architecture or coding standards.",
            answer_outline: "STAR response: evaluate trade-offs objectively, communicate rationale, align with team goals.",
            difficulty: 2,
            requirement_ids: ["r3"],
          },
        ],
      };
    }

    if (step.includes("generate-flashcards") || prompt.user.includes("flashcards")) {
      return {
        flashcards: [
          {
            front: "Resilient Microservices Architecture",
            back: "Key patterns include circuit breakers, retries with exponential backoff, and idempotent operations.",
            requirement_ids: ["r1"],
          },
          {
            front: "Database Indexing Principles",
            back: "B-Tree indexes speed up range and equality queries; compound indexes must follow leftmost prefix rule.",
            requirement_ids: ["r2"],
          },
        ],
      };
    }

    if (step.startsWith("coverage-repair")) {
      return {
        questions: [],
      };
    }

    // Default fallback object
    return {};
  });
}

function deriveCompanyName(companyFromExtraction: string, companyUrl: string): string {
  if (companyFromExtraction && companyFromExtraction.trim()) {
    return companyFromExtraction.trim();
  }
  try {
    const parsed = new URL(companyUrl);
    const host = parsed.hostname.replace(/^www\./, "");
    const parts = host.split(".");
    if (parts.length > 0 && parts[0]) {
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
  } catch {
    // Ignore invalid url format
  }
  return "Evaluated Company";
}

/**
 * End-to-end kit generation pipeline.
 * Coordinates retrieval, extraction, question generation, flashcard creation,
 * coverage verification, and schedule allocation.
 */
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
        message: "Job description is empty or contains only whitespace.",
      },
    };
  }

  if (!Number.isInteger(input.days) || input.days < 1) {
    return {
      id: input.id,
      status: "failed",
      kit: null,
      error: {
        code: "INVALID_INPUT",
        message: "Days parameter must be a positive integer.",
      },
    };
  }

  try {
    // 1. Determine LLM client
    let llmClient: ILlmClient;
    if (options.llmClient) {
      llmClient = options.llmClient;
    } else if (options.useFakeLlm) {
      llmClient = createDefaultFakeLlmClient(input.jd);
    } else {
      const providers = loadProvidersFromEnv();
      if (providers.length === 0) {
        // Fallback to fake LLM client if no provider API keys are configured
        llmClient = createDefaultFakeLlmClient(input.jd);
      } else {
        llmClient = new MultiProviderLlmClient(providers, {
          customCacheDir: options.customCacheDir,
        });
      }
    }

    // 2. Parallel Stage 1: Requirements extraction and site crawl
    const crawlPromise: Promise<CrawlResult> = options.crawledPages
      ? Promise.resolve({
          pages: options.crawledPages,
          hiringPageFound: options.crawledPages.some((p) => p.kind === "hiring"),
          aboutPageFound: options.crawledPages.some((p) => p.kind === "about"),
          robotsStatus: "allowed" as const,
        })
      : crawlSite(input.company_url, {
          maxPages: options.crawlMaxPages ?? 5,
          maxDepth: 2,
          politeDelayMs: 0,
        });

    const [extractionResult, crawlResult] = await Promise.all([
      extractRequirements(input.jd, llmClient),
      crawlPromise,
    ]);

    // Ensure at least one requirement exists if extraction returned none
    let requirements = extractionResult.role.requirements;
    const allWarnings: Warning[] = [...extractionResult.warnings];

    if (requirements.length === 0) {
      requirements = [
        {
          id: "r1",
          text: "Core role responsibilities and experience",
          kind: "technical",
          priority: "must",
          evidence: input.jd.slice(0, 100).trim() || "Job description",
        },
      ];
      allWarnings.push({
        code: "NO_REQUIREMENTS_EXTRACTED",
        message: "No specific requirements could be grounded in the job description; created general role requirement.",
      });
    }

    const companyName = deriveCompanyName(
      extractionResult.sourceDetails.company,
      input.company_url
    );

    // 3. Discussion Search & Process Extraction
    const discussionResult = await searchDiscussion(
      companyName,
      options.fetchFn
    );

    const hiringPages = crawlResult.pages.filter(
      (p) => p.status === "fetched" && (p.kind === "hiring" || p.kind === "about")
    );

    // 4. Parallel Stage 2: Company brief and hiring process extraction
    const [companyBrief, hiringProcess] = await Promise.all([
      extractCompanyBrief(
        input.company_url,
        companyName,
        crawlResult.pages,
        input.jd,
        llmClient
      ),
      extractProcess(
        hiringPages,
        discussionResult.sources,
        undefined,
        llmClient
      ),
    ]);

    // 5. Question Planning & Initial Question Generation
    const updatedRole = {
      ...extractionResult.role,
      requirements,
    };

    const initialCounters = {
      r: requirements.length,
      q: 0,
      f: 0,
    };

    // Construct base working kit
    let workingKit: Kit = {
      source: {
        company: companyName,
        company_url: input.company_url,
        role: updatedRole.title || "Software Engineer",
        location: extractionResult.sourceDetails.location || "",
        jd_chars: input.jd.length,
        researched_at: new Date().toISOString(),
        pages_used: [],
      },
      company_brief: companyBrief,
      role: updatedRole,
      questions: [],
      flashcards: [],
      schedule: {
        days_available: input.days,
        days: [],
      },
      coverage: {
        uncovered_requirement_ids: [],
        passes: 1,
      },
      warnings: [],
      research: {
        pages: crawlResult.pages.map((p) => ({
          url: p.url,
          kind: p.kind,
          status: p.status,
          reason: p.reason ?? null,
        })),
        discussion: discussionResult,
        hiring_process: hiringProcess,
      },
      id_counters: initialCounters,
    };

    const plan = planQuestions(updatedRole, hiringProcess, companyBrief);

    const { questions: genQuestions, updatedKit: kitAfterQuestions } =
      await generateAllQuestions(
        updatedRole,
        companyBrief,
        hiringProcess,
        plan,
        llmClient,
        workingKit
      );
    workingKit = kitAfterQuestions;

    // 6. Flashcard Generation
    const { flashcards, updatedKit: kitAfterFlashcards, warnings: flashcardWarnings } =
      await generateFlashcards(
        genQuestions,
        requirements,
        llmClient,
        workingKit
      );
    workingKit = kitAfterFlashcards;
    allWarnings.push(...flashcardWarnings);

    // 7. Coverage Loop (guaranteeing 100% must-have coverage)
    const {
      questions: finalQuestions,
      updatedKit: kitAfterCoverage,
      coverage,
      warnings: coverageWarnings,
    } = await runCoverageLoop(
      requirements,
      genQuestions,
      llmClient,
      workingKit
    );
    workingKit = kitAfterCoverage;
    allWarnings.push(...coverageWarnings);

    // 8. Deterministic Schedule Allocation
    const schedule = allocateSchedule(finalQuestions, requirements, input.days);

    // 9. Collect pages used
    const pagesUsedSet = new Set<string>();
    for (const p of crawlResult.pages) {
      if (p.status === "fetched") {
        pagesUsedSet.add(p.url);
      }
    }
    for (const src of companyBrief.sources) {
      pagesUsedSet.add(src);
    }
    for (const d of discussionResult.sources) {
      pagesUsedSet.add(d.url);
    }
    const pagesUsed = Array.from(pagesUsedSet);

    // Check crawler & discussion statuses for warnings
    if (crawlResult.robotsStatus === "disallowed") {
      allWarnings.push({
        code: "ROBOTS_DISALLOWED",
        message: `Robots.txt disallowed crawling for ${input.company_url}`,
      });
    }
    if (crawlResult.error) {
      allWarnings.push({
        code: "CRAWL_FAILED",
        message: `Crawl notice for ${input.company_url}: ${crawlResult.error}`,
      });
    }
    if (discussionResult.status === "failed") {
      allWarnings.push({
        code: "DISCUSSION_SEARCH_FAILED",
        message: `Discussion search failed: ${discussionResult.error ?? "Search error"}`,
      });
    }

    // 10. Assemble authoritative Kit
    const finalKit: Kit = {
      source: {
        company: companyName,
        company_url: input.company_url,
        role: updatedRole.title || "Software Engineer",
        location: extractionResult.sourceDetails.location || "",
        jd_chars: input.jd.length,
        researched_at: new Date().toISOString(),
        pages_used: pagesUsed,
      },
      company_brief: companyBrief,
      role: updatedRole,
      questions: finalQuestions,
      flashcards,
      schedule,
      coverage,
      warnings: allWarnings,
      research: workingKit.research,
      id_counters: workingKit.id_counters,
    };

    // 11. Validate Kit before output
    const validation = validateKit(finalKit);
    if (!validation.valid) {
      return {
        id: input.id,
        status: "failed",
        kit: null,
        error: {
          code: "VALIDATION_FAILED",
          message: validation.errors.map((e) => e.message).join("; "),
        },
      };
    }

    return {
      id: input.id,
      status: "ok",
      kit: finalKit,
      error: null,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      id: input.id,
      status: "failed",
      kit: null,
      error: {
        code: "PIPELINE_ERROR",
        message: errorMsg,
      },
    };
  }
}
