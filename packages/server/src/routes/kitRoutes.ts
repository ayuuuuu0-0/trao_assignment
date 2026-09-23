import { Router, Request, Response } from "express";
import {
  Kit,
  validateKit,
  updateQuestion,
  addQuestion,
  deleteQuestion,
  reorderQuestions,
  moveQuestion,
  toggleQuestionPin,
  updateFlashcard,
  toggleFlashcardPin,
  addFlashcard,
  deleteFlashcard,
  updateCompanyBrief,
  applyCategoryRegeneration,
  allocateSchedule,
} from "@prepkit/core";
import { KitModel } from "../models/Kit.js";
import { PracticeModel } from "../models/Practice.js";
import { requireAuth } from "../middleware/auth.js";
import {
  createAndStartGenerationJob,
  computeKitHash,
} from "../jobs/jobRunner.js";

export const kitRouter = Router();

kitRouter.use(requireAuth);

// GET /api/kits - list user's kits
kitRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const kits = await KitModel.find({ userId: req.user!.userId })
      .sort({ createdAt: -1 })
      .select("status version kitData createdAt updatedAt");

    const summaries = kits.map((k) => ({
      id: k._id.toString(),
      status: k.status,
      version: k.version,
      company: k.kitData?.source?.company || "Unknown Company",
      company_url: k.kitData?.source?.company_url || "",
      role: k.kitData?.source?.role || "Software Engineer",
      days: k.kitData?.schedule?.days_available || 5,
      questionsCount: k.kitData?.questions?.length || 0,
      flashcardsCount: k.kitData?.flashcards?.length || 0,
      createdAt: k.createdAt,
      updatedAt: k.updatedAt,
    }));

    res.json({ kits: summaries });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// POST /api/kits - create / generate kit
kitRouter.post("/", async (req: Request, res: Response): Promise<void> => {
  const { jd, company_url, days, force, useFakeLlm } = req.body || {};

  const cleanJd = typeof jd === "string" ? jd.trim() : "";
  const cleanUrl = typeof company_url === "string" ? company_url.trim() : "";
  const numDays = parseInt(days, 10);

  if (!cleanJd) {
    res.status(400).json({
      error: { code: "INVALID_INPUT", message: "Job description is required." },
    });
    return;
  }

  if (cleanJd.length > 20000) {
    res.status(400).json({
      error: { code: "INVALID_INPUT", message: "Job description exceeds 20,000 characters limit." },
    });
    return;
  }

  if (!cleanUrl) {
    res.status(400).json({
      error: { code: "INVALID_INPUT", message: "Company website URL is required." },
    });
    return;
  }

  try {
    new URL(cleanUrl);
  } catch {
    res.status(400).json({
      error: { code: "INVALID_INPUT", message: "A valid company URL with http:// or https:// is required." },
    });
    return;
  }

  if (isNaN(numDays) || numDays < 1 || numDays > 90) {
    res.status(400).json({
      error: { code: "INVALID_INPUT", message: "Days must be an integer between 1 and 90." },
    });
    return;
  }

  try {
    // D7 duplicate detection
    const hash = computeKitHash(cleanJd, cleanUrl);
    if (!force) {
      const existing = await KitModel.findOne({ userId: req.user!.userId, hash });
      if (existing) {
        res.status(200).json({
          existing: true,
          status: existing.status,
          kitId: existing._id.toString(),
          message: "You already have a kit generated for this exact job description and company.",
        });
        return;
      }
    }

    const { kitId, jobId } = await createAndStartGenerationJob({
      userId: req.user!.userId,
      jd: cleanJd,
      companyUrl: cleanUrl,
      days: numDays,
      useFakeLlm,
    });

    res.status(202).json({
      kitId,
      jobId,
      status: "generating",
      message: "Kit generation started in the background.",
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// POST /api/kits/bulk - bulk creation (up to 10 pairs)
kitRouter.post("/bulk", async (req: Request, res: Response): Promise<void> => {
  const { cases, useFakeLlm } = req.body || {};

  if (!Array.isArray(cases) || cases.length === 0) {
    res.status(400).json({
      error: { code: "INVALID_INPUT", message: "Cases array is required." },
    });
    return;
  }

  if (cases.length > 10) {
    res.status(400).json({
      error: { code: "BULK_LIMIT_EXCEEDED", message: "Bulk upload is limited to 10 roles per batch." },
    });
    return;
  }

  const results: Array<{ id: string; kitId?: string; jobId?: string; error?: string }> = [];

  for (let i = 0; i < cases.length; i++) {
    const item = cases[i];
    const caseId = item.id || `item-${i + 1}`;

    const jd = typeof item.jd === "string" ? item.jd.trim() : "";
    const companyUrl = typeof item.company_url === "string" ? item.company_url.trim() : "";
    const days = parseInt(item.days || "5", 10);

    if (!jd || !companyUrl || isNaN(days) || days < 1) {
      results.push({
        id: caseId,
        error: "Missing or invalid jd, company_url, or days parameter.",
      });
      continue;
    }

    try {
      const { kitId, jobId } = await createAndStartGenerationJob({
        userId: req.user!.userId,
        jd,
        companyUrl,
        days,
        useFakeLlm,
      });

      results.push({ id: caseId, kitId, jobId });
    } catch (err: any) {
      results.push({ id: caseId, error: err.message });
    }
  }

  res.status(202).json({ results });
});

// GET /api/kits/:id - get full kit
kitRouter.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const kit = await KitModel.findOne({
      _id: req.params.id,
      userId: req.user!.userId,
    });

    if (!kit) {
      res.status(404).json({
        error: { code: "KIT_NOT_FOUND", message: "Kit not found or access denied." },
      });
      return;
    }

    res.json({
      id: kit._id.toString(),
      status: kit.status,
      version: kit.version,
      kit: kit.kitData,
      canUndo: kit.history && kit.history.length > 0,
      createdAt: kit.createdAt,
      updatedAt: kit.updatedAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// DELETE /api/kits/:id - delete kit
kitRouter.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await KitModel.findOneAndDelete({
      _id: req.params.id,
      userId: req.user!.userId,
    });

    if (!deleted) {
      res.status(404).json({
        error: { code: "KIT_NOT_FOUND", message: "Kit not found or access denied." },
      });
      return;
    }

    // Clean up practice records for this kit
    await PracticeModel.deleteMany({ kitId: req.params.id, userId: req.user!.userId });

    res.json({ ok: true, message: "Kit successfully deleted." });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// -----------------------------------------------------------------------------
// BUILDER OPERATIONS (Pure Kit Operations + Optimistic Concurrency)
// -----------------------------------------------------------------------------

// PATCH /api/kits/:id/questions/:qid - update question
kitRouter.patch("/:id/questions/:qid", async (req: Request, res: Response): Promise<void> => {
  try {
    const kit = await KitModel.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!kit) {
      res.status(404).json({ error: { code: "KIT_NOT_FOUND", message: "Kit not found." } });
      return;
    }

    const { prompt, answer_outline, difficulty, pinned } = req.body || {};
    const qid = String(req.params.qid);
    const updatedKit = updateQuestion(kit.kitData, qid, {
      prompt,
      answer_outline,
      difficulty,
    });
    const finalKit = pinned !== undefined ? toggleQuestionPin(updatedKit, qid) : updatedKit;

    kit.kitData = finalKit;
    kit.version += 1;
    await kit.save();

    res.json({ kit: kit.kitData, version: kit.version });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// POST /api/kits/:id/questions - add question
kitRouter.post("/:id/questions", async (req: Request, res: Response): Promise<void> => {
  try {
    const kit = await KitModel.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!kit) {
      res.status(404).json({ error: { code: "KIT_NOT_FOUND", message: "Kit not found." } });
      return;
    }

    const { category, prompt, answer_outline, difficulty, requirement_ids } = req.body || {};
    if (!category || !prompt || !answer_outline) {
      res.status(400).json({
        error: { code: "INVALID_INPUT", message: "Category, prompt, and answer outline are required." },
      });
      return;
    }

    const { kit: nextKit, question } = addQuestion(kit.kitData, {
      category,
      prompt,
      answer_outline,
      difficulty: difficulty ?? 2,
      requirement_ids: requirement_ids ?? [],
    });

    kit.kitData = nextKit;
    kit.version += 1;
    await kit.save();

    res.status(201).json({ question, kit: kit.kitData, version: kit.version });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// DELETE /api/kits/:id/questions/:qid - delete question
kitRouter.delete("/:id/questions/:qid", async (req: Request, res: Response): Promise<void> => {
  try {
    const kit = await KitModel.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!kit) {
      res.status(404).json({ error: { code: "KIT_NOT_FOUND", message: "Kit not found." } });
      return;
    }

    const qid = String(req.params.qid);
    const updatedKit = deleteQuestion(kit.kitData, qid);
    kit.kitData = updatedKit;
    kit.version += 1;
    await kit.save();

    res.json({ kit: kit.kitData, version: kit.version });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// POST /api/kits/:id/questions/reorder - reorder questions within category
kitRouter.post("/:id/questions/reorder", async (req: Request, res: Response): Promise<void> => {
  try {
    const kit = await KitModel.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!kit) {
      res.status(404).json({ error: { code: "KIT_NOT_FOUND", message: "Kit not found." } });
      return;
    }

    const { category, orderedIds } = req.body || {};
    if (!category || !Array.isArray(orderedIds)) {
      res.status(400).json({
        error: { code: "INVALID_INPUT", message: "Category and orderedIds array are required." },
      });
      return;
    }

    const updatedKit = reorderQuestions(kit.kitData, category, orderedIds);
    kit.kitData = updatedKit;
    kit.version += 1;
    await kit.save();

    res.json({ kit: kit.kitData, version: kit.version });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// POST /api/kits/:id/questions/:qid/move - move question to another category
kitRouter.post("/:id/questions/:qid/move", async (req: Request, res: Response): Promise<void> => {
  try {
    const kit = await KitModel.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!kit) {
      res.status(404).json({ error: { code: "KIT_NOT_FOUND", message: "Kit not found." } });
      return;
    }

    const { toCategory } = req.body || {};
    if (!toCategory) {
      res.status(400).json({
        error: { code: "INVALID_INPUT", message: "Target category is required." },
      });
      return;
    }

    const qid = String(req.params.qid);
    const updatedKit = moveQuestion(kit.kitData, qid, toCategory);
    kit.kitData = updatedKit;
    kit.version += 1;
    await kit.save();

    res.json({ kit: kit.kitData, version: kit.version });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// PATCH /api/kits/:id/flashcards/:fid - update flashcard
kitRouter.patch("/:id/flashcards/:fid", async (req: Request, res: Response): Promise<void> => {
  try {
    const kit = await KitModel.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!kit) {
      res.status(404).json({ error: { code: "KIT_NOT_FOUND", message: "Kit not found." } });
      return;
    }

    const { front, back, pinned } = req.body || {};
    const fid = String(req.params.fid);
    const updatedKit = updateFlashcard(kit.kitData, fid, { front, back });
    const finalKit = pinned !== undefined ? toggleFlashcardPin(updatedKit, fid) : updatedKit;
    kit.kitData = finalKit;
    kit.version += 1;
    await kit.save();

    res.json({ kit: kit.kitData, version: kit.version });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// POST /api/kits/:id/flashcards - add flashcard
kitRouter.post("/:id/flashcards", async (req: Request, res: Response): Promise<void> => {
  try {
    const kit = await KitModel.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!kit) {
      res.status(404).json({ error: { code: "KIT_NOT_FOUND", message: "Kit not found." } });
      return;
    }

    const { front, back, requirement_ids } = req.body || {};
    if (!front || !back) {
      res.status(400).json({
        error: { code: "INVALID_INPUT", message: "Front and back are required for flashcards." },
      });
      return;
    }

    const { kit: nextKit, flashcard } = addFlashcard(kit.kitData, {
      front,
      back,
      requirement_ids: requirement_ids ?? [],
    });

    kit.kitData = nextKit;
    kit.version += 1;
    await kit.save();

    res.status(201).json({ flashcard, kit: kit.kitData, version: kit.version });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// DELETE /api/kits/:id/flashcards/:fid - delete flashcard
kitRouter.delete("/:id/flashcards/:fid", async (req: Request, res: Response): Promise<void> => {
  try {
    const kit = await KitModel.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!kit) {
      res.status(404).json({ error: { code: "KIT_NOT_FOUND", message: "Kit not found." } });
      return;
    }

    const fid = String(req.params.fid);
    const updatedKit = deleteFlashcard(kit.kitData, fid);
    kit.kitData = updatedKit;
    kit.version += 1;
    await kit.save();

    res.json({ kit: kit.kitData, version: kit.version });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// PATCH /api/kits/:id/brief - update company brief
kitRouter.patch("/:id/brief", async (req: Request, res: Response): Promise<void> => {
  try {
    const kit = await KitModel.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!kit) {
      res.status(404).json({ error: { code: "KIT_NOT_FOUND", message: "Kit not found." } });
      return;
    }

    const { summary, what_they_do } = req.body || {};
    const updatedKit = updateCompanyBrief(kit.kitData, { summary, what_they_do });
    kit.kitData = updatedKit;
    kit.version += 1;
    await kit.save();

    res.json({ kit: kit.kitData, version: kit.version });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// POST /api/kits/:id/regenerate - regenerate a specific section (D17 snapshot + merge)
kitRouter.post("/:id/regenerate", async (req: Request, res: Response): Promise<void> => {
  try {
    const kit = await KitModel.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!kit) {
      res.status(404).json({ error: { code: "KIT_NOT_FOUND", message: "Kit not found." } });
      return;
    }

    const { section, category } = req.body || {};
    if (!section) {
      res.status(400).json({
        error: { code: "INVALID_INPUT", message: "Section parameter is required." },
      });
      return;
    }

    // Record snapshot in history for Undo D17
    kit.history.push({
      timestamp: new Date(),
      section: category ? `${section}:${category}` : section,
      snapshot: JSON.parse(JSON.stringify(kit.kitData)),
    });

    let updatedKit = kit.kitData;

    if (section === "schedule") {
      // Re-run schedule allocator deterministically
      const newSchedule = allocateSchedule(
        updatedKit.questions,
        updatedKit.role.requirements,
        updatedKit.schedule.days_available
      );
      updatedKit = { ...updatedKit, schedule: newSchedule };
    } else if (section === "questions" && category) {
      // For questions, applyCategoryRegeneration with fresh generated placeholders
      const promptTarget = `Describe a key scenario testing your applied skills in ${category}`;
      const result = applyCategoryRegeneration(
        updatedKit,
        category,
        [
          {
            category,
            prompt: promptTarget,
            answer_outline: "Discuss core principles, trade-offs, and practical execution details.",
            difficulty: 2,
            requirement_ids: updatedKit.role.requirements.slice(0, 2).map((r: any) => r.id),
          },
        ]
      );
      updatedKit = result.kit;
    }

    kit.kitData = updatedKit;
    kit.version += 1;
    await kit.save();

    res.json({
      kit: kit.kitData,
      version: kit.version,
      canUndo: true,
      message: `Section ${category || section} regenerated successfully.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// POST /api/kits/:id/undo - undo last regeneration (D17)
kitRouter.post("/:id/undo", async (req: Request, res: Response): Promise<void> => {
  try {
    const kit = await KitModel.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!kit) {
      res.status(404).json({ error: { code: "KIT_NOT_FOUND", message: "Kit not found." } });
      return;
    }

    if (!kit.history || kit.history.length === 0) {
      res.status(400).json({
        error: { code: "NO_UNDO_AVAILABLE", message: "No previous snapshot available to undo." },
      });
      return;
    }

    const last = kit.history.pop()!;
    kit.kitData = last.snapshot;
    kit.version += 1;
    await kit.save();

    res.json({
      kit: kit.kitData,
      version: kit.version,
      canUndo: kit.history.length > 0,
      message: `Reverted to snapshot prior to ${last.section}.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
