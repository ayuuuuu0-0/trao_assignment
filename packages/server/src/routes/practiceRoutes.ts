import { Router, Request, Response } from "express";
import { KitModel } from "../models/Kit.js";
import { PracticeModel } from "../models/Practice.js";
import { requireAuth } from "../middleware/auth.js";

export const practiceRouter = Router();

practiceRouter.use(requireAuth);

// GET /api/kits/:id/practice/queue - returns flashcard queue ordered per D9
practiceRouter.get("/:id/practice/queue", async (req: Request, res: Response): Promise<void> => {
  try {
    const kit = await KitModel.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!kit) {
      res.status(404).json({ error: { code: "KIT_NOT_FOUND", message: "Kit not found." } });
      return;
    }

    const cards = kit.kitData?.flashcards || [];
    if (cards.length === 0) {
      res.json({ cards: [], totalCards: 0, seenCount: 0 });
      return;
    }

    const records = await PracticeModel.find({
      userId: req.user!.userId,
      kitId: req.params.id,
    });
    const recordMap = new Map(records.map((r) => [r.cardId, r]));

    // Sort cards per D9:
    // 1. Unseen cards first
    // 2. Lower last confidence first
    // 3. Older lastSeenAt first
    // 4. Stable card ID sort
    const sorted = [...cards].sort((a, b) => {
      const recA = recordMap.get(a.id);
      const recB = recordMap.get(b.id);

      const seenA = Boolean(recA);
      const seenB = Boolean(recB);

      if (!seenA && seenB) return -1;
      if (seenA && !seenB) return 1;

      if (recA && recB) {
        if (recA.confidence !== recB.confidence) {
          return recA.confidence - recB.confidence; // 1 before 5
        }
        const timeA = recA.lastSeenAt.getTime();
        const timeB = recB.lastSeenAt.getTime();
        if (timeA !== timeB) return timeA - timeB; // older before newer
      }

      return a.id.localeCompare(b.id);
    });

    const sessionCards = sorted.slice(0, 10).map((card) => {
      const rec = recordMap.get(card.id);
      return {
        ...card,
        lastConfidence: rec?.confidence ?? null,
        seenCount: rec?.seenCount ?? 0,
        lastAnswer: rec?.writtenAnswer ?? "",
      };
    });

    res.json({
      cards: sessionCards,
      totalCards: cards.length,
      practicedCardsCount: records.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// POST /api/kits/:id/practice/:cardId - record practice rating and written answer
practiceRouter.post("/:id/practice/:cardId", async (req: Request, res: Response): Promise<void> => {
  try {
    const { confidence, writtenAnswer } = req.body || {};
    const confNum = parseInt(confidence, 10);

    if (isNaN(confNum) || confNum < 1 || confNum > 5) {
      res.status(400).json({
        error: { code: "INVALID_INPUT", message: "Confidence must be an integer between 1 and 5." },
      });
      return;
    }

    const record = await PracticeModel.findOneAndUpdate(
      {
        userId: req.user!.userId,
        kitId: req.params.id,
        cardId: req.params.cardId,
      },
      {
        $set: {
          confidence: confNum,
          writtenAnswer: typeof writtenAnswer === "string" ? writtenAnswer.trim() : "",
          lastSeenAt: new Date(),
        },
        $inc: { seenCount: 1 },
      },
      { upsert: true, new: true }
    );

    res.json({ ok: true, record });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});

// GET /api/kits/:id/practice/summary - coverage and readiness metrics
practiceRouter.get("/:id/practice/summary", async (req: Request, res: Response): Promise<void> => {
  try {
    const kit = await KitModel.findOne({ _id: req.params.id, userId: req.user!.userId });
    if (!kit) {
      res.status(404).json({ error: { code: "KIT_NOT_FOUND", message: "Kit not found." } });
      return;
    }

    const cards = kit.kitData?.flashcards || [];
    const requirements = kit.kitData?.role?.requirements || [];
    const records = await PracticeModel.find({
      userId: req.user!.userId,
      kitId: req.params.id,
    });

    const practicedCardIds = new Set(records.map((r) => r.cardId));

    // A requirement is practiced if any card referencing it has been seen
    const practicedReqIds = new Set<string>();
    for (const card of cards) {
      if (practicedCardIds.has(card.id)) {
        for (const rid of card.requirement_ids) {
          practicedReqIds.add(rid);
        }
      }
    }

    const mustReqs = requirements.filter((r: any) => r.priority === "must");
    const unpracticedMusts = mustReqs.filter((r: any) => !practicedReqIds.has(r.id));

    const totalRatings = records.reduce((acc: number, r: any) => acc + r.confidence, 0);
    const avgConfidence = records.length > 0 ? Number((totalRatings / records.length).toFixed(1)) : 0;

    res.json({
      totalCards: cards.length,
      practicedCardsCount: records.length,
      totalRequirements: requirements.length,
      practicedRequirementsCount: practicedReqIds.size,
      unpracticedMustCount: unpracticedMusts.length,
      unpracticedMustRequirements: unpracticedMusts,
      averageConfidence: avgConfidence,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err.message } });
  }
});
