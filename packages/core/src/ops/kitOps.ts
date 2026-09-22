import {
  Kit,
  Question,
  Flashcard,
  QuestionCategory,
  CompanyBrief,
  IdCounters,
} from "../schema/kit.js";

/**
 * Checks if a question is eligible for automated replacement during regeneration.
 * Per DECISIONS.md D8: replaceable only when origin is "generated", edited is false, and pinned is false.
 */
export function isQuestionReplaceable(q: Question): boolean {
  const origin = q.origin ?? "generated";
  const edited = q.edited ?? false;
  const pinned = q.pinned ?? false;
  return origin === "generated" && !edited && !pinned;
}

/**
 * Checks if a flashcard is eligible for automated replacement during regeneration.
 */
export function isFlashcardReplaceable(f: Flashcard): boolean {
  const origin = f.origin ?? "generated";
  const edited = f.edited ?? false;
  const pinned = f.pinned ?? false;
  return origin === "generated" && !edited && !pinned;
}

/**
 * Ensures the kit has an initialized id_counters object.
 * If missing, initializes based on existing maximum numbers found in IDs to avoid collisions.
 */
export function ensureIdCounters(kit: Kit): IdCounters {
  if (kit.id_counters) {
    return { ...kit.id_counters };
  }

  const parseMax = (items: Array<{ id: string }>, prefix: string): number => {
    let max = 0;
    for (const item of items) {
      if (item.id.startsWith(prefix)) {
        const num = parseInt(item.id.slice(prefix.length), 10);
        if (!isNaN(num) && num > max) max = num;
      }
    }
    return max;
  };

  return {
    r: parseMax(kit.role.requirements, "r"),
    q: parseMax(kit.questions, "q"),
    f: parseMax(kit.flashcards, "f"),
  };
}

/**
 * Generates the next sequential ID using the kit's stored counter.
 * Crucially: increments the counter so IDs are never reused even after deletions.
 */
export function allocateNextId(
  kit: Kit,
  prefix: "r" | "q" | "f"
): { nextKit: Kit; id: string } {
  const counters = ensureIdCounters(kit);
  counters[prefix] += 1;
  const id = `${prefix}${counters[prefix]}`;
  const nextKit: Kit = {
    ...kit,
    id_counters: counters,
  };
  return { nextKit, id };
}

// ---------------------------------------------------------------------------
// Question Operations
// ---------------------------------------------------------------------------

export function updateQuestion(
  kit: Kit,
  qid: string,
  patch: Partial<Pick<Question, "prompt" | "answer_outline" | "difficulty" | "requirement_ids">>
): Kit {
  return {
    ...kit,
    questions: kit.questions.map((q) => {
      if (q.id !== qid) return q;
      return {
        ...q,
        ...patch,
        edited: true,
      };
    }),
  };
}

export function addQuestion(
  kit: Kit,
  data: {
    category: QuestionCategory;
    prompt: string;
    answer_outline: string;
    difficulty?: number;
    requirement_ids?: string[];
  }
): { kit: Kit; question: Question } {
  const { nextKit, id } = allocateNextId(kit, "q");

  const question: Question = {
    id,
    category: data.category,
    prompt: data.prompt,
    answer_outline: data.answer_outline,
    difficulty: data.difficulty ?? 2,
    requirement_ids: data.requirement_ids ?? [],
    origin: "user",
    edited: false,
    pinned: false,
  };

  // Add question and schedule it into day 1 if days exist
  const updatedSchedule = {
    ...nextKit.schedule,
    days: nextKit.schedule.days.map((day, idx) => {
      if (idx === 0) {
        return {
          ...day,
          question_ids: [...day.question_ids, id],
        };
      }
      return day;
    }),
  };

  return {
    kit: {
      ...nextKit,
      questions: [...nextKit.questions, question],
      schedule: updatedSchedule,
    },
    question,
  };
}

export function deleteQuestion(kit: Kit, qid: string): Kit {
  return {
    ...kit,
    questions: kit.questions.filter((q) => q.id !== qid),
    schedule: {
      ...kit.schedule,
      days: kit.schedule.days.map((day) => ({
        ...day,
        question_ids: day.question_ids.filter((id) => id !== qid),
      })),
    },
  };
}

export function toggleQuestionPin(kit: Kit, qid: string): Kit {
  return {
    ...kit,
    questions: kit.questions.map((q) => {
      if (q.id !== qid) return q;
      return {
        ...q,
        pinned: !(q.pinned ?? false),
      };
    }),
  };
}

export function reorderQuestions(
  kit: Kit,
  category: QuestionCategory,
  orderedIds: string[]
): Kit {
  const categoryQuestions = kit.questions.filter((q) => q.category === category);
  const otherQuestions = kit.questions.filter((q) => q.category !== category);

  const qMap = new Map(categoryQuestions.map((q) => [q.id, q]));
  const reordered: Question[] = [];

  for (const id of orderedIds) {
    const q = qMap.get(id);
    if (q) {
      reordered.push(q);
      qMap.delete(id);
    }
  }

  // Any questions in category not explicitly ordered remain at the end
  for (const remaining of qMap.values()) {
    reordered.push(remaining);
  }

  return {
    ...kit,
    questions: [...otherQuestions, ...reordered],
  };
}

export function moveQuestion(
  kit: Kit,
  qid: string,
  toCategory: QuestionCategory
): Kit {
  return {
    ...kit,
    questions: kit.questions.map((q) => {
      if (q.id !== qid) return q;
      return {
        ...q,
        category: toCategory,
        edited: true,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Flashcard Operations
// ---------------------------------------------------------------------------

export function updateFlashcard(
  kit: Kit,
  fid: string,
  patch: Partial<Pick<Flashcard, "front" | "back">>
): Kit {
  return {
    ...kit,
    flashcards: kit.flashcards.map((f) => {
      if (f.id !== fid) return f;
      return {
        ...f,
        ...patch,
        edited: true,
      };
    }),
  };
}

export function addFlashcard(
  kit: Kit,
  data: { front: string; back: string; requirement_ids?: string[] }
): { kit: Kit; flashcard: Flashcard } {
  const { nextKit, id } = allocateNextId(kit, "f");

  const flashcard: Flashcard = {
    id,
    requirement_ids: data.requirement_ids ?? [],
    front: data.front,
    back: data.back,
    origin: "user",
    edited: false,
    pinned: false,
  };


  return {
    kit: {
      ...nextKit,
      flashcards: [...nextKit.flashcards, flashcard],
    },
    flashcard,
  };
}

export function deleteFlashcard(kit: Kit, fid: string): Kit {
  return {
    ...kit,
    flashcards: kit.flashcards.filter((f) => f.id !== fid),
  };
}

export function toggleFlashcardPin(kit: Kit, fid: string): Kit {
  return {
    ...kit,
    flashcards: kit.flashcards.map((f) => {
      if (f.id !== fid) return f;
      return {
        ...f,
        pinned: !(f.pinned ?? false),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Company Brief Operations
// ---------------------------------------------------------------------------

export function updateCompanyBrief(
  kit: Kit,
  patch: Partial<Pick<CompanyBrief, "summary" | "what_they_do">>
): Kit {
  const existingEdited = new Set(kit.company_brief.edited_fields ?? []);

  for (const key of Object.keys(patch)) {
    existingEdited.add(key);
  }

  return {
    ...kit,
    company_brief: {
      ...kit.company_brief,
      ...patch,
      edited_fields: Array.from(existingEdited),
    },
  };
}

// ---------------------------------------------------------------------------
// Merge-time Regeneration Reducer
// ---------------------------------------------------------------------------

export interface ApplyRegenerationResult {
  kit: Kit;
  keptCount: number;
  replacedCount: number;
  addedCount: number;
}

/**
 * Merges newly generated questions into a specific category.
 * Protects any question that is edited, pinned, or user-created.
 * Replaces only unedited, unpinned generated questions.
 * Removes dangling schedule IDs from replaced questions and schedules new ones.
 */
export function applyCategoryRegeneration(
  latestKit: Kit,
  category: QuestionCategory,
  incomingQuestions: Array<Omit<Question, "id" | "origin" | "edited" | "pinned">>
): ApplyRegenerationResult {
  const categoryQuestions = latestKit.questions.filter((q) => q.category === category);
  const otherQuestions = latestKit.questions.filter((q) => q.category !== category);

  // Partition at merge-time
  const protectedQuestions = categoryQuestions.filter((q) => !isQuestionReplaceable(q));
  const replacedQuestions = categoryQuestions.filter((q) => isQuestionReplaceable(q));

  const replacedIds = new Set(replacedQuestions.map((q) => q.id));

  // Assign fresh IDs using stored counters
  let workingKit = latestKit;
  const newQuestions: Question[] = [];

  for (const incoming of incomingQuestions) {
    const { nextKit, id } = allocateNextId(workingKit, "q");
    workingKit = nextKit;
    newQuestions.push({
      ...incoming,
      id,
      category,
      origin: "generated",
      edited: false,
      pinned: false,
    });
  }

  const finalQuestions = [...otherQuestions, ...protectedQuestions, ...newQuestions];

  // Clean replaced dangling IDs from the schedule
  let updatedDays = workingKit.schedule.days.map((day) => ({
    ...day,
    question_ids: day.question_ids.filter((id) => !replacedIds.has(id)),
  }));

  // Distribute new questions into schedule days with lowest current question count
  for (const nq of newQuestions) {
    if (updatedDays.length > 0) {
      let minDay = updatedDays[0]!;
      for (const d of updatedDays) {
        if (d.question_ids.length < minDay.question_ids.length) {
          minDay = d;
        }
      }
      minDay.question_ids.push(nq.id);
    }
  }

  const finalKit: Kit = {
    ...workingKit,
    questions: finalQuestions,
    schedule: {
      ...workingKit.schedule,
      days: updatedDays,
    },
  };

  return {
    kit: finalKit,
    keptCount: protectedQuestions.length,
    replacedCount: replacedQuestions.length,
    addedCount: newQuestions.length,
  };
}
