import { Router, Request, Response } from "express";
import { JobModel } from "../models/Job.js";
import { KitModel } from "../models/Kit.js";
import { requireAuth } from "../middleware/auth.js";
import { createAndStartGenerationJob } from "../jobs/jobRunner.js";

export const jobRouter = Router();

// GET /api/jobs/:id
jobRouter.get("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const job = await JobModel.findOne({ jobId: req.params.id, userId: req.user!.userId });
    if (!job) {
      res.status(404).json({
        error: { code: "JOB_NOT_FOUND", message: "Generation job not found." },
      });
      return;
    }

    res.json({
      job: {
        id: job.jobId,
        kitId: job.kitId,
        status: job.status,
        steps: job.steps,
        pages: job.pages,
        sources: job.sources,
        error: job.error ?? null,
        createdAt: job.createdAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: err.message },
    });
  }
});

// POST /api/jobs/:id/retry
jobRouter.post("/:id/retry", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const job = await JobModel.findOne({ jobId: req.params.id, userId: req.user!.userId });
    if (!job) {
      res.status(404).json({
        error: { code: "JOB_NOT_FOUND", message: "Generation job not found." },
      });
      return;
    }

    const kit = await KitModel.findById(job.kitId);
    if (!kit) {
      res.status(404).json({
        error: { code: "KIT_NOT_FOUND", message: "Associated kit not found." },
      });
      return;
    }

    // Spawn retry job
    const newJob = await createAndStartGenerationJob({
      userId: req.user!.userId,
      jd: kit.kitData.role?.responsibilities?.join("\n") || "Job Description",
      companyUrl: kit.kitData.source?.company_url || "https://example.com",
      days: kit.kitData.schedule?.days_available || 5,
    });

    res.json({
      message: "Job restarted successfully.",
      jobId: newJob.jobId,
      kitId: newJob.kitId,
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: err.message },
    });
  }
});
