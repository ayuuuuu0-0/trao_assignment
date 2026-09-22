import { z } from "zod";
import {
  Role,
  Question,
  QuestionCategory,
  CompanyBrief,
  ProcessRecord,
  Kit,
} from "../schema/kit.js";
import { ILlmClient } from "../llm/types.js";
import { wrapUntrusted, UNTRUSTED_DATA_SYSTEM_INSTRUCTION } from "../llm/wrapUntrusted.js";
import { allocateNextId } from "../ops/kitOps.js";
import { QuestionPlan } from "./planQuestions.js";

export const RawQuestionItemSchema = z.object({
  requirement_ids: z.array(z.string()).default([]),
  prompt: z.string().min(1),
  answer_outline: z.string().min(1),
  difficulty: z.number().int().min(1).max(3).default(2),
});

export const RawQuestionsResponseSchema = z.object({
  questions: z.array(RawQuestionItemSchema),
});

const TECHNICAL_SYSTEM_PROMPT = `${UNTRUSTED_DATA_SYSTEM_INSTRUCTION}

You are an expert technical interviewer creating questions to test specific candidate requirements.
Instructions:
1. Generate technical interview questions strictly mapped to the provided requirement IDs.
2. "answer_outline" must contain 3 to 6 bullet points detailing what a strong answer should demonstrate.
3. Difficulty: 1 (fundamental recall/syntax), 2 (applied practical implementation/debugging), 3 (deep internals/trade-offs).
4. Return strict JSON.`;

const BEHAVIOURAL_SYSTEM_PROMPT = `${UNTRUSTED_DATA_SYSTEM_INSTRUCTION}

You are an executive behavioural interviewer creating STAR-method interview questions.
Instructions:
1. Generate behavioural questions addressing teamwork, conflict resolution, mentoring, and ownership.
2. Map questions to any matching behavioural requirement IDs provided.
3. "answer_outline" must detail the Situation, Task, Action, and Result expectations.
4. Difficulty: 1 (basic teamwork), 2 (handling difficult situations/deadlines), 3 (leading through ambiguity/systemic changes).
5. Return strict JSON.`;

const SYSTEM_DESIGN_SYSTEM_PROMPT = `${UNTRUSTED_DATA_SYSTEM_INSTRUCTION}

You are a principal systems architect creating system design interview questions.
Instructions:
1. Generate system design and architecture questions relevant to the role's responsibilities and technologies.
2. Outline key components, data flow, scale considerations, and trade-offs in "answer_outline".
3. Only reference technologies mentioned in the provided role requirements.
4. Return strict JSON.`;

const COMPANY_FIT_SYSTEM_PROMPT = `${UNTRUSTED_DATA_SYSTEM_INSTRUCTION}

You are a company culture and mission interviewer.
Instructions:
1. Generate company-fit and values questions grounded strictly in the provided company brief.
2. Never assume or invent facts about the company that are not present in the brief.
3. "answer_outline" should describe what alignment with the company's stated mission looks like.
4. Return strict JSON.`;

function getPromptForCategory(
  category: QuestionCategory,
  role: Role,
  brief: CompanyBrief,
  process: ProcessRecord,
  targetCount: number
): { system: string; user: string } {
  let system = TECHNICAL_SYSTEM_PROMPT;
  let context = "";

  if (category === "technical") {
    system = TECHNICAL_SYSTEM_PROMPT;
    const techReqs = role.requirements.filter(
      (r) => r.kind === "technical" || r.kind === "domain"
    );
    context = `Target count: ${targetCount} questions.\nRequirements to cover:\n${techReqs.map((r) => `[${r.id}] (${r.priority}) ${r.text}`).join("\n")}`;
  } else if (category === "behavioural") {
    system = BEHAVIOURAL_SYSTEM_PROMPT;
    const behavReqs = role.requirements.filter((r) => r.kind === "behavioural");
    context = `Target count: ${targetCount} questions.\nRequirements to cover:\n${behavReqs.map((r) => `[${r.id}] ${r.text}`).join("\n")}`;
  } else if (category === "system-design") {
    system = SYSTEM_DESIGN_SYSTEM_PROMPT;
    const techReqs = role.requirements.filter(
      (r) => r.kind === "technical" || r.kind === "domain"
    );
    context = `Target count: ${targetCount} questions.\nSeniority: ${role.seniority}\nResponsibilities:\n${role.responsibilities.join("\n")}\n\nKey Technologies:\n${techReqs.map((r) => `[${r.id}] ${r.text}`).join("\n")}`;
  } else if (category === "company-fit") {
    system = COMPANY_FIT_SYSTEM_PROMPT;
    context = `Target count: ${targetCount} questions.\nCompany Summary:\n${brief.summary}\nWhat they do:\n${brief.what_they_do}`;
  }

  const user = `Generate ${targetCount} interview questions for the "${category}" category based on:\n\n${wrapUntrusted("context", context)}`;

  return { system, user };
}

export async function generateCategoryQuestions(
  category: QuestionCategory,
  targetCount: number,
  role: Role,
  brief: CompanyBrief,
  process: ProcessRecord,
  llmClient: ILlmClient
): Promise<Array<Omit<Question, "id">>> {
  if (targetCount <= 0) {
    return [];
  }

  const { system, user } = getPromptForCategory(category, role, brief, process, targetCount);

  try {
    const raw = await llmClient.generateJson(
      { system, user, stepName: `questions-${category}` },
      RawQuestionsResponseSchema
    );

    const validRequirementIds = new Set(role.requirements.map((r) => r.id));
    const processed: Array<Omit<Question, "id">> = [];
    const seenPrompts = new Set<string>();

    for (const q of raw.questions) {
      const cleanPrompt = q.prompt.trim();
      if (!cleanPrompt || seenPrompts.has(cleanPrompt.toLowerCase())) continue;
      seenPrompts.add(cleanPrompt.toLowerCase());

      const qReqIds = q.requirement_ids || [];
      const filteredReqIds = qReqIds.filter((id) => validRequirementIds.has(id));


      // Discard questions with no valid requirements (except company-fit)
      if (filteredReqIds.length === 0 && category !== "company-fit") {
        continue;
      }

      processed.push({
        category,
        prompt: cleanPrompt,
        answer_outline: q.answer_outline.trim(),
        difficulty: Math.max(1, Math.min(3, q.difficulty || 2)),
        requirement_ids: filteredReqIds,
        origin: "generated",
        edited: false,
        pinned: false,
      });
    }

    return processed;
  } catch {
    return [];
  }
}

export async function generateAllQuestions(
  role: Role,
  brief: CompanyBrief,
  process: ProcessRecord,
  plan: QuestionPlan,
  llmClient: ILlmClient,
  baseKit: Kit
): Promise<{ questions: Question[]; updatedKit: Kit }> {
  const categories: QuestionCategory[] = [
    "technical",
    "behavioural",
    "system-design",
    "company-fit",
  ];

  let currentKit = baseKit;
  const allQuestions: Question[] = [];

  for (const cat of categories) {
    const target = plan[cat] ?? 0;
    const items = await generateCategoryQuestions(cat, target, role, brief, process, llmClient);

    for (const item of items) {
      const { nextKit, id } = allocateNextId(currentKit, "q");
      currentKit = nextKit;
      allQuestions.push({
        ...item,
        id,
      });
    }
  }

  return { questions: allQuestions, updatedKit: currentKit };
}
