import { describe, it, expect } from "vitest";
import {
  Kit,
  Question,
  Flashcard,
} from "../src/schema/kit.js";
import {
  isQuestionReplaceable,
  isFlashcardReplaceable,
  allocateNextId,
  updateQuestion,
  addQuestion,
  deleteQuestion,
  toggleQuestionPin,
  reorderQuestions,
  moveQuestion,
  updateFlashcard,
  addFlashcard,
  deleteFlashcard,
  toggleFlashcardPin,
  updateCompanyBrief,
  applyCategoryRegeneration,
} from "../src/ops/kitOps.js";

function makeMinimalKit(): Kit {
  return {
    source: {
      company: "Acme",
      company_url: "https://acme.com",
      role: "Backend Engineer",
      location: "Remote",
      jd_chars: 1200,
      researched_at: "2026-09-21T00:00:00Z",
      pages_used: [],
    },
    company_brief: {
      summary: "Acme makes SaaS tools.",
      what_they_do: "Cloud software.",
      sources: [],
      edited_fields: [],
    },
    role: {
      title: "Backend Engineer",
      seniority: "Senior",
      responsibilities: ["Build APIs"],
      requirements: [
        { id: "r1", text: "Node.js", kind: "technical", priority: "must" },
        { id: "r2", text: "PostgreSQL", kind: "technical", priority: "must" },
      ],
    },
    questions: [
      {
        id: "q1",
        category: "technical",
        prompt: "Explain event loop",
        answer_outline: "Call stack, task queue",
        difficulty: 3,
        requirement_ids: ["r1"],
        origin: "generated",
        edited: false,
        pinned: false,
      },
      {
        id: "q2",
        category: "technical",
        prompt: "Postgres indexing",
        answer_outline: "B-Tree vs Hash",
        difficulty: 3,
        requirement_ids: ["r2"],
        origin: "generated",
        edited: false,
        pinned: false,
      },
      {
        id: "q3",
        category: "behavioural",
        prompt: "Tell me about a conflict",
        answer_outline: "STAR technique",
        difficulty: 2,
        requirement_ids: [],
        origin: "generated",
        edited: false,
        pinned: false,
      },
    ],
    flashcards: [
      {
        id: "f1",
        requirement_ids: ["r1"],
        front: "ACID properties",
        back: "Atomicity, Consistency, Isolation, Durability",
        origin: "generated",
        edited: false,
        pinned: false,
      },
    ],

    schedule: {
      days: [
        {
          day: 1,
          focus: "Node.js foundations",
          question_ids: ["q1", "q2"],
          minutes: 60,
        },
        {
          day: 2,
          focus: "Behavioural prep",
          question_ids: ["q3"],
          minutes: 45,
        },
      ],
    },
    coverage: {
      must_have_count: 2,
      covered_must_haves: 2,
      uncovered_requirement_ids: [],
      passes: 1,
    },
    id_counters: { r: 2, q: 3, f: 1 },
  };
}

describe("isQuestionReplaceable & isFlashcardReplaceable", () => {
  it("returns true only when generated, unedited, and unpinned", () => {
    const q: Question = {
      id: "q1",
      category: "technical",
      prompt: "Test",
      answer_outline: "Answer",
      difficulty: 2,
      requirement_ids: [],
      origin: "generated",
      edited: false,
      pinned: false,
    };
    expect(isQuestionReplaceable(q)).toBe(true);

    // Edited -> false
    expect(isQuestionReplaceable({ ...q, edited: true })).toBe(false);
    // Pinned -> false
    expect(isQuestionReplaceable({ ...q, pinned: true })).toBe(false);
    // User-origin -> false
    expect(isQuestionReplaceable({ ...q, origin: "user" })).toBe(false);
    // Fallback-origin -> false
    expect(isQuestionReplaceable({ ...q, origin: "fallback" })).toBe(false);
  });
});

describe("allocateNextId - Stored Counter Protection", () => {
  it("increments stored counter and does not reuse deleted IDs", () => {
    const kit = makeMinimalKit();
    // Delete q3 (the highest ID)
    const afterDelete = deleteQuestion(kit, "q3");
    expect(afterDelete.questions.find((q) => q.id === "q3")).toBeUndefined();

    // Adding a new question must NOT reuse q3; it must assign q4!
    const { kit: afterAdd, question } = addQuestion(afterDelete, {
      category: "technical",
      prompt: "New question",
      answer_outline: "New outline",
    });

    expect(question.id).toBe("q4");
    expect(afterAdd.id_counters?.q).toBe(4);
  });
});

describe("Question Operations", () => {
  it("updateQuestion modifies content and sets edited=true", () => {
    const kit = makeMinimalKit();
    const updated = updateQuestion(kit, "q1", { prompt: "Custom prompt" });
    const q = updated.questions.find((x) => x.id === "q1")!;
    expect(q.prompt).toBe("Custom prompt");
    expect(q.edited).toBe(true);
  });

  it("addQuestion sets origin=user and schedules into day 1", () => {
    const kit = makeMinimalKit();
    const { kit: updated, question } = addQuestion(kit, {
      category: "technical",
      prompt: "System design basics",
      answer_outline: "CAP theorem",
    });

    expect(question.origin).toBe("user");
    expect(question.edited).toBe(false);
    expect(question.pinned).toBe(false);
    expect(updated.questions.some((q) => q.id === question.id)).toBe(true);
    expect(updated.schedule.days[0]!.question_ids).toContain(question.id);
  });

  it("deleteQuestion removes question and dangling schedule IDs", () => {
    const kit = makeMinimalKit();
    expect(kit.schedule.days[0]!.question_ids).toContain("q1");

    const updated = deleteQuestion(kit, "q1");
    expect(updated.questions.some((q) => q.id === "q1")).toBe(false);
    expect(updated.schedule.days[0]!.question_ids).not.toContain("q1");
  });

  it("toggleQuestionPin flips pinned state", () => {
    const kit = makeMinimalKit();
    const pinned = toggleQuestionPin(kit, "q1");
    expect(pinned.questions.find((q) => q.id === "q1")?.pinned).toBe(true);

    const unpinned = toggleQuestionPin(pinned, "q1");
    expect(unpinned.questions.find((q) => q.id === "q1")?.pinned).toBe(false);
  });

  it("reorderQuestions rearranges items within category", () => {
    const kit = makeMinimalKit();
    const reordered = reorderQuestions(kit, "technical", ["q2", "q1"]);
    const technicalQs = reordered.questions.filter((q) => q.category === "technical");
    expect(technicalQs[0]!.id).toBe("q2");
    expect(technicalQs[1]!.id).toBe("q1");
  });

  it("moveQuestion changes category and sets edited=true", () => {
    const kit = makeMinimalKit();
    const moved = moveQuestion(kit, "q1", "system-design");
    const q = moved.questions.find((x) => x.id === "q1")!;
    expect(q.category).toBe("system-design");
    expect(q.edited).toBe(true);
  });
});

describe("Flashcard Operations", () => {
  it("updateFlashcard marks edited=true", () => {
    const kit = makeMinimalKit();
    const updated = updateFlashcard(kit, "f1", { back: "Updated back text" });
    const f = updated.flashcards.find((x) => x.id === "f1")!;
    expect(f.back).toBe("Updated back text");
    expect(f.edited).toBe(true);
  });

  it("addFlashcard assigns sequential ID with origin=user", () => {
    const kit = makeMinimalKit();
    const { kit: updated, flashcard } = addFlashcard(kit, {
      front: "New card",
      back: "New answer",
    });
    expect(flashcard.id).toBe("f2");
    expect(flashcard.origin).toBe("user");
    expect(updated.flashcards.length).toBe(2);
  });

  it("deleteFlashcard removes card", () => {
    const kit = makeMinimalKit();
    const updated = deleteFlashcard(kit, "f1");
    expect(updated.flashcards.length).toBe(0);
  });

  it("toggleFlashcardPin flips pinned state", () => {
    const kit = makeMinimalKit();
    const updated = toggleFlashcardPin(kit, "f1");
    expect(updated.flashcards[0]!.pinned).toBe(true);
  });
});

describe("Company Brief Operations", () => {
  it("updateCompanyBrief records changed fields in edited_fields array", () => {
    const kit = makeMinimalKit();
    const updated = updateCompanyBrief(kit, { summary: "New custom summary" });
    expect(updated.company_brief.summary).toBe("New custom summary");
    expect(updated.company_brief.edited_fields).toContain("summary");
  });
});

describe("applyCategoryRegeneration - Merge-Time Protection", () => {
  it("protects edited and pinned questions while replacing unedited ones", () => {
    let kit = makeMinimalKit();

    // User edits q1
    kit = updateQuestion(kit, "q1", { prompt: "User edited prompt" });
    // User pins q2
    kit = toggleQuestionPin(kit, "q2");

    // Add an unedited replaceable question q4 in technical
    const { kit: withQ4 } = addQuestion(kit, {
      category: "technical",
      prompt: "Temporary replaceable",
      answer_outline: "Outline",
    });
    // Set q4 to origin="generated" to test replaceability
    withQ4.questions = withQ4.questions.map((q) =>
      q.id === "q4" ? { ...q, origin: "generated", edited: false, pinned: false } : q
    );

    // Regenerate technical category with 2 new questions
    const incoming = [
      {
        category: "technical" as const,
        prompt: "Generated Q A",
        answer_outline: "Outline A",
        difficulty: 3,
        requirement_ids: ["r1"],
      },
      {
        category: "technical" as const,
        prompt: "Generated Q B",
        answer_outline: "Outline B",
        difficulty: 2,
        requirement_ids: ["r2"],
      },
    ];

    const result = applyCategoryRegeneration(withQ4, "technical", incoming);

    // q1 (edited) and q2 (pinned) must SURVIVE
    expect(result.kit.questions.some((q) => q.id === "q1" && q.prompt === "User edited prompt")).toBe(true);
    expect(result.kit.questions.some((q) => q.id === "q2" && q.pinned === true)).toBe(true);

    // q4 (replaceable) must be REPLACED
    expect(result.kit.questions.some((q) => q.id === "q4")).toBe(false);

    // New questions received fresh IDs (q5, q6)
    expect(result.kit.questions.some((q) => q.prompt === "Generated Q A" && q.id === "q5")).toBe(true);
    expect(result.kit.questions.some((q) => q.prompt === "Generated Q B" && q.id === "q6")).toBe(true);

    // Schedule should NOT have dangling q4
    for (const day of result.kit.schedule.days) {
      expect(day.question_ids).not.toContain("q4");
    }

    // Counts
    expect(result.keptCount).toBe(2); // q1 and q2 kept
    expect(result.replacedCount).toBe(1); // q4 replaced
    expect(result.addedCount).toBe(2); // q5 and q6 added
  });
});
