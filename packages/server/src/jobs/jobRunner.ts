import crypto from "node:crypto";
import { runPipeline, Kit, BatchCaseInput } from "@prepkit/core";
import { KitModel } from "../models/Kit.js";
import { JobModel, IJobStep } from "../models/Job.js";

const DEFAULT_STEPS: IJobStep[] = [
  { name: "extract-requirements", status: "pending", detail: "Extracting skills, responsibilities and priority" },
  { name: "crawl-and-discussion", status: "pending", detail: "Crawling company pages and searching interview discussions" },
  { name: "brief-and-process", status: "pending", detail: "Synthesizing company brief and hiring process stages" },
  { name: "generate-questions", status: "pending", detail: "Generating technical, behavioural, design, and culture questions" },
  { name: "generate-flashcards", status: "pending", detail: "Creating study flashcards from requirements" },
  { name: "coverage-loop", status: "pending", detail: "Verifying and closing requirement coverage gaps" },
  { name: "allocate-schedule", status: "pending", detail: "Allocating deterministic day-by-day study schedule" },
];

export function computeKitHash(jd: string, companyUrl: string): string {
  const normJd = jd.toLowerCase().replace(/\s+/g, " ").trim();
  const normUrl = companyUrl.toLowerCase().trim().replace(/\/+$/, "");
  return crypto.createHash("sha256").update(`${normJd}:::${normUrl}`).digest("hex");
}

export async function createAndStartGenerationJob(params: {
  userId: string;
  jd: string;
  companyUrl: string;
  days: number;
  useFakeLlm?: boolean;
}): Promise<{ kitId: string; jobId: string }> {
  const { userId, jd, companyUrl, days, useFakeLlm } = params;
  const hash = computeKitHash(jd, companyUrl);
  const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

  // Initial stub Kit document
  const initialKitData: Kit = {
    source: {
      company: "Analyzing...",
      company_url: companyUrl,
      role: "Analyzing...",
      location: "",
      jd_chars: jd.length,
      researched_at: new Date().toISOString(),
      pages_used: [],
    },
    company_brief: {
      summary: "Generation in progress...",
      what_they_do: "",
      sources: [],
    },
    role: {
      title: "Analyzing...",
      seniority: "",
      responsibilities: [],
      requirements: [],
    },
    questions: [],
    flashcards: [],
    schedule: {
      days_available: days,
      days: [],
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 0,
    },
    warnings: [],
    id_counters: { r: 0, q: 0, f: 0 },
  };

  const kitDoc = await KitModel.create({
    userId,
    status: "generating",
    hash,
    version: 1,
    kitData: initialKitData,
    history: [],
  });

  const kitId = kitDoc._id.toString();

  await JobModel.create({
    jobId,
    userId,
    kitId,
    status: "running",
    steps: DEFAULT_STEPS.map((s) => ({ ...s })),
    pages: [],
    sources: [],
    traces: [],
  });

  // Execute pipeline in background asynchronously
  runBackgroundPipeline(jobId, kitId, {
    id: kitId,
    jd,
    company_url: companyUrl,
    days,
  }, useFakeLlm).catch((err) => {
    console.error(`[jobRunner] Unhandled failure in job ${jobId}:`, err);
  });

  return { kitId, jobId };
}

async function updateStep(
  jobId: string,
  stepName: string,
  status: "running" | "done" | "failed" | "skipped",
  detail?: string
) {
  const update: Record<string, any> = {
    "steps.$[elem].status": status,
  };
  if (status === "running") {
    update["steps.$[elem].startedAt"] = new Date();
  } else if (status === "done" || status === "failed") {
    update["steps.$[elem].finishedAt"] = new Date();
  }
  if (detail) {
    update["steps.$[elem].detail"] = detail;
  }

  await JobModel.updateOne(
    { jobId },
    { $set: update },
    { arrayFilters: [{ "elem.name": stepName }] }
  );
}

async function runBackgroundPipeline(
  jobId: string,
  kitId: string,
  input: BatchCaseInput,
  useFakeLlm?: boolean
) {
  try {
    await updateStep(jobId, "extract-requirements", "running");

    // Execute core pipeline
    const result = await runPipeline(input, {
      allowPrivateHosts: true,
      useFakeLlm,
    });

    if (result.status === "failed") {
      await JobModel.updateOne(
        { jobId },
        {
          $set: {
            status: "failed",
            error: result.error?.message || "Kit generation pipeline failed.",
          },
        }
      );
      await KitModel.findByIdAndUpdate(kitId, {
        $set: { status: "failed" },
      });
      return;
    }

    const kit = result.kit;

    // Mark steps completed
    for (const step of DEFAULT_STEPS) {
      await updateStep(jobId, step.name, "done");
    }

    // Determine status
    const hasWarnings = (kit.warnings && kit.warnings.length > 0);
    const finalStatus = hasWarnings ? "partial" : "ready";

    // Update kit document
    await KitModel.findByIdAndUpdate(kitId, {
      $set: {
        status: finalStatus,
        kitData: kit,
        version: 1,
      },
    });

    // Update job document
    await JobModel.updateOne(
      { jobId },
      {
        $set: {
          status: hasWarnings ? "partial" : "succeeded",
          pages: kit.research?.pages || [],
          sources: (kit.research?.discussion?.sources as any) || [],
        },
      }
    );
  } catch (err: any) {
    console.error(`[jobRunner] Exception in job ${jobId}:`, err);
    await JobModel.updateOne(
      { jobId },
      {
        $set: {
          status: "failed",
          error: err.message || "An unexpected error occurred during kit generation.",
        },
      }
    );
    await KitModel.findByIdAndUpdate(kitId, {
      $set: { status: "failed" },
    });
  }
}
