import { z } from "zod";
import {
  Flashcard,
  Question,
  Requirement,
  Kit,
  Warning,
} from "../schema/kit.js";
import { ILlmClient } from "../llm/types.js";
import { wrapUntrusted, UNTRUSTED_DATA_SYSTEM_INSTRUCTION } from "../llm/wrapUntrusted.js";
import { allocateNextId } from "../ops/kitOps.js";

export const RawFlashcardItemSchema = z.object({
  requirement_ids: z.array(z.string()).default([]),
  front: z.string().min(1),
  back: z.string().min(1),
});

export const RawFlashcardsResponseSchema = z.object({
  flashcards: z.array(RawFlashcardItemSchema),
});

const FLASHCARDS_SYSTEM_PROMPT = `${UNTRUSTED_DATA_SYSTEM_INSTRUCTION}

You are an expert technical study guide creator making flashcards for interview preparation.
Instructions:
1. "front": Concise prompt, concept, or test question (under 140 characters).
2. "back": Direct, memorable answer or summary (under 300 characters).
3. Associate each card with relevant requirement IDs from the provided list.
4. Return strict JSON.`;

/**
 * Deterministic fallback to derive flashcards directly from questions if the model fails.
 */
export function deriveFlashcardsFromQuestions(
  questions: Question[],
  baseKit: Kit
): { flashcards: Flashcard[]; updatedKit: Kit; warnings: Warning[] } {
  let currentKit = baseKit;
  const flashcards: Flashcard[] = [];

  for (const q of questions) {
    const { nextKit, id } = allocateNextId(currentKit, "f");
    currentKit = nextKit;

    flashcards.push({
      id,
      requirement_ids: q.requirement_ids,
      front: q.prompt.slice(0, 140),
      back: q.answer_outline.slice(0, 300),
      origin: "fallback",
      edited: false,
      pinned: false,
    });
  }

  return {
    flashcards,
    updatedKit: currentKit,
    warnings: [
      {
        code: "FLASHCARDS_DERIVED",
        message: "Flashcards were derived deterministically from questions.",
      },
    ],
  };
}

export async function generateFlashcards(
  questions: Question[],
  requirements: Requirement[],
  llmClient: ILlmClient,
  baseKit: Kit
): Promise<{ flashcards: Flashcard[]; updatedKit: Kit; warnings: Warning[] }> {
  if (questions.length === 0) {
    return { flashcards: [], updatedKit: baseKit, warnings: [] };
  }

  const validReqIds = new Set(requirements.map((r) => r.id));

  const context = `Questions:\n${questions.map((q) => `[${q.id}] (${q.category}): ${q.prompt}`).join("\n")}\n\nRequirements:\n${requirements.map((r) => `[${r.id}] ${r.text}`).join("\n")}`;
  const userPrompt = `Generate study flashcards from the following interview questions and requirements:\n\n${wrapUntrusted("study-material", context)}`;

  try {
    const raw = await llmClient.generateJson(
      { system: FLASHCARDS_SYSTEM_PROMPT, user: userPrompt, stepName: "generate-flashcards" },
      RawFlashcardsResponseSchema
    );

    if (!raw.flashcards || raw.flashcards.length === 0) {
      return deriveFlashcardsFromQuestions(questions, baseKit);
    }

    let currentKit = baseKit;
    const flashcards: Flashcard[] = [];

    for (const card of raw.flashcards) {
      const { nextKit, id } = allocateNextId(currentKit, "f");
      currentKit = nextKit;

      const cardReqIds = card.requirement_ids || [];
      const filteredReqIds = cardReqIds.filter((rid) => validReqIds.has(rid));

      flashcards.push({
        id,
        requirement_ids: filteredReqIds,
        front: card.front.slice(0, 140).trim(),
        back: card.back.slice(0, 300).trim(),
        origin: "generated",
        edited: false,
        pinned: false,
      });
    }

    return { flashcards, updatedKit: currentKit, warnings: [] };
  } catch {
    // Graceful fallback to deterministic derivation
    return deriveFlashcardsFromQuestions(questions, baseKit);
  }
}
