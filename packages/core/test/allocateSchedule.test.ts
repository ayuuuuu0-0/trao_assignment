import { describe, it, expect } from "vitest";
import { allocateSchedule } from "../src/schedule/allocate.js";
import { Question, Requirement } from "../src/schema/kit.js";

function makeQuestions(count: number): Question[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `q${i + 1}`,
    category: (i % 2 === 0 ? "technical" : "behavioural") as const,
    prompt: `Question prompt ${i + 1}`,
    answer_outline: `Answer outline ${i + 1}`,
    difficulty: ((i % 3) + 1) as 1 | 2 | 3,
    requirement_ids: [`r${(i % 5) + 1}`],
    origin: "generated" as const,
  }));
}

function makeRequirements(count: number): Requirement[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `r${i + 1}`,
    text: `Requirement ${i + 1}`,
    kind: "technical" as const,
    priority: i < 3 ? "must" as const : "nice" as const,
  }));
}

describe("allocateSchedule - Deterministic Invariants & Days Range", () => {
  const reqs = makeRequirements(5);

  it.each([1, 2, 5, 14, 60])("allocates exactly N=%i days", (N) => {
    const questions = makeQuestions(20);
    const schedule = allocateSchedule(questions, reqs, N);

    expect(schedule.days.length).toBe(N);
    for (let i = 0; i < N; i++) {
      expect(schedule.days[i].day).toBe(i + 1);
      expect(Number.isInteger(schedule.days[i].minutes)).toBe(true);
      expect(schedule.days[i].minutes).toBeGreaterThanOrEqual(0);
    }
  });

  it("never leaves an empty day when Q >= N", () => {
    const questions = makeQuestions(15);
    const schedule = allocateSchedule(questions, reqs, 5);

    expect(schedule.days.length).toBe(5);
    for (const day of schedule.days) {
      expect(day.question_ids.length).toBeGreaterThanOrEqual(1);
      expect(day.minutes).toBeGreaterThan(0);
    }
  });

  it("handles Q < N by introducing review days cycling hardest questions first", () => {
    const questions = makeQuestions(3); // 3 questions, 7 days
    const schedule = allocateSchedule(questions, reqs, 7);

    expect(schedule.days.length).toBe(7);

    // Days 1..3 hold unique questions
    expect(schedule.days[0].focus).not.toContain("Review:");
    expect(schedule.days[1].focus).not.toContain("Review:");
    expect(schedule.days[2].focus).not.toContain("Review:");

    // Days 4..7 are review days
    expect(schedule.days[3].focus).toContain("Review:");
    expect(schedule.days[4].focus).toContain("Review:");
    expect(schedule.days[5].focus).toContain("Review:");
    expect(schedule.days[6].focus).toContain("Review:");
  });

  it("handles Q = 0 gracefully with 0 minutes and informative focus", () => {
    const schedule = allocateSchedule([], reqs, 5);
    expect(schedule.days.length).toBe(5);
    for (const day of schedule.days) {
      expect(day.question_ids).toEqual([]);
      expect(day.minutes).toBe(0);
      expect(day.focus).toContain("No questions available");
    }
  });

  it("front-loads high-difficulty and must-have questions to earlier days", () => {
    // Mixed questions with difficulty 1, 2, 3
    const questions = makeQuestions(10);
    const schedule = allocateSchedule(questions, reqs, 5);

    // Day 1 should have questions with high difficulty (3 or 2)
    const day1QIds = schedule.days[0].question_ids;
    const day1Questions = questions.filter((q) => day1QIds.includes(q.id));
    expect(day1Questions.some((q) => q.difficulty === 3)).toBe(true);
  });

  it("is pure and repeatable: returns identical output for identical input", () => {
    const questions = makeQuestions(12);
    const scheduleA = allocateSchedule(questions, reqs, 4);
    const scheduleB = allocateSchedule(questions, reqs, 4);

    expect(scheduleA).toEqual(scheduleB);
  });

  it("keeps ALL questions for N = 1 without dropping any", () => {
    const questions = makeQuestions(25);
    const schedule = allocateSchedule(questions, reqs, 1);

    expect(schedule.days.length).toBe(1);
    expect(schedule.days[0].question_ids.length).toBe(25);
  });
});
