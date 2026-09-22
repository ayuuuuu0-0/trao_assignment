import { Question, Requirement, Schedule, ScheduleDay } from "../schema/kit.js";

function getQuestionMinutes(difficulty: number, isReview = false): number {
  let mins: number;
  if (difficulty >= 3) {
    mins = 20;
  } else if (difficulty <= 1) {
    mins = 10;
  } else {
    mins = 15;
  }

  if (isReview) {
    return Math.ceil(mins / 2);
  }
  return mins;
}

/**
 * Pure, deterministic schedule allocator conforming strictly to Skill 35 / Section 6.12.
 */
export function allocateSchedule(
  questions: Question[],
  requirements: Requirement[],
  N: number
): Schedule {
  if (N <= 0 || !Number.isInteger(N)) {
    throw new Error(`Schedule days N must be a positive integer, got ${N}`);
  }

  const reqMap = new Map(requirements.map((r) => [r.id, r]));

  // 1. Calculate priority score and sort questions deterministically
  const sorted = [...questions].sort((a, b) => {
    // Priority score: 2 if covers at least one 'must' requirement, else 1
    const aHasMust = a.requirement_ids.some((id) => reqMap.get(id)?.priority === "must");
    const bHasMust = b.requirement_ids.some((id) => reqMap.get(id)?.priority === "must");
    const aScore = aHasMust ? 2 : 1;
    const bScore = bHasMust ? 2 : 1;

    if (bScore !== aScore) return bScore - aScore;
    if (b.difficulty !== a.difficulty) return b.difficulty - a.difficulty;

    // Must-have count
    const aMustCount = a.requirement_ids.filter((id) => reqMap.get(id)?.priority === "must").length;
    const bMustCount = b.requirement_ids.filter((id) => reqMap.get(id)?.priority === "must").length;
    if (bMustCount !== aMustCount) return bMustCount - aMustCount;

    // Stable ID sort
    return a.id.localeCompare(b.id);
  });

  const Q = sorted.length;
  const days: ScheduleDay[] = [];

  // Helper to compute day focus
  function makeFocus(qIds: string[], isReview = false): string {
    if (qIds.length === 0) {
      return "No questions available. Add questions in the builder.";
    }
    const topQ = sorted.find((q) => q.id === qIds[0]);
    if (!topQ) return "General review";

    const topReqId = topQ.requirement_ids[0];
    const reqText = topReqId ? reqMap.get(topReqId)?.text : "";
    const detail = reqText ? reqText.slice(0, 50) : topQ.prompt.slice(0, 50);

    const prefix = isReview ? "Review: " : "";
    const catLabel = topQ.category.charAt(0).toUpperCase() + topQ.category.slice(1);
    return `${prefix}${catLabel} - ${detail}`;
  }

  // -------------------------------------------------------------------------
  // Case Q = 0: No questions available
  // -------------------------------------------------------------------------
  if (Q === 0) {
    for (let d = 1; d <= N; d++) {
      days.push({
        day: d,
        focus: "No questions available. Add questions in the builder.",
        question_ids: [],
        minutes: 0,
      });
    }
    return { days_available: N, days };
  }


  // -------------------------------------------------------------------------
  // Case Q >= N: At least as many questions as days
  // -------------------------------------------------------------------------
  if (Q >= N) {
    // Each day gets 1 question base
    const quotas = new Array<number>(N).fill(1);
    const extras = Q - N;

    if (extras > 0) {
      // Linear decreasing weights: w(d) = 2N - d + 1
      const weights = Array.from({ length: N }, (_, i) => 2 * N - (i + 1) + 1);
      const totalWeight = weights.reduce((acc, w) => acc + w, 0);

      const shares = weights.map((w) => (extras * w) / totalWeight);
      const floors = shares.map((s) => Math.floor(s));
      const allocatedFloors = floors.reduce((acc, f) => acc + f, 0);
      let remainder = extras - allocatedFloors;

      // Largest-remainder distribution
      const remaindersWithIndex = shares
        .map((s, idx) => ({ idx, rem: s - Math.floor(s) }))
        .sort((a, b) => b.rem - a.rem);

      for (let i = 0; i < remainder; i++) {
        const item = remaindersWithIndex[i % remaindersWithIndex.length];
        if (item) floors[item.idx]++;
      }

      for (let i = 0; i < N; i++) {
        quotas[i] += floors[i] ?? 0;
      }
    }

    // Deal sorted questions into consecutive day blocks by quota
    let qIndex = 0;
    for (let d = 1; d <= N; d++) {
      const quota = quotas[d - 1] ?? 1;
      const dayQIds: string[] = [];
      let dayMins = 0;

      for (let i = 0; i < quota && qIndex < Q; i++) {
        const q = sorted[qIndex++];
        if (q) {
          dayQIds.push(q.id);
          dayMins += getQuestionMinutes(q.difficulty, false);
        }
      }

      days.push({
        day: d,
        focus: makeFocus(dayQIds, false),
        question_ids: dayQIds,
        minutes: dayMins,
      });
    }
  } else {
    // -----------------------------------------------------------------------
    // Case Q < N: More days than questions
    // -----------------------------------------------------------------------
    // Days 1 to Q hold 1 unique question each
    for (let d = 1; d <= Q; d++) {
      const q = sorted[d - 1]!;
      days.push({
        day: d,
        focus: makeFocus([q.id], false),
        question_ids: [q.id],
        minutes: getQuestionMinutes(q.difficulty, false),
      });
    }

    // Days Q+1 to N are review days cycling hardest first
    for (let d = Q + 1; d <= N; d++) {
      const cycleIdx = (d - Q - 1) % Q;
      const q = sorted[cycleIdx]!;
      days.push({
        day: d,
        focus: makeFocus([q.id], true),
        question_ids: [q.id],
        minutes: getQuestionMinutes(q.difficulty, true),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Assert Post-Conditions (Skill 35)
  // -------------------------------------------------------------------------
  if (days.length !== N) {
    throw new Error(`Schedule post-condition violation: expected ${N} days, got ${days.length}`);
  }

  return { days_available: N, days };
}

