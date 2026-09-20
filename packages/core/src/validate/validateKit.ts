import { Kit, KitSchema } from "../schema/kit.js";

export interface KitValidationError {
  path: string;
  message: string;
  code: string;
}

export interface KitValidationResult {
  valid: boolean;
  errors: KitValidationError[];
}

export function validateKit(candidate: unknown): KitValidationResult {
  const errors: KitValidationError[] = [];

  const parseResult = KitSchema.safeParse(candidate);
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      errors.push({
        path: issue.path.join("."),
        message: issue.message,
        code: "SCHEMA_VALIDATION_ERROR"
      });
    }
    return { valid: false, errors };
  }

  const kit: Kit = parseResult.data;

  const requirementIdSet = new Set<string>();
  for (const req of kit.role.requirements) {
    if (requirementIdSet.has(req.id)) {
      errors.push({
        path: `role.requirements`,
        message: `Duplicate requirement id: ${req.id}`,
        code: "DUPLICATE_REQUIREMENT_ID"
      });
    }
    requirementIdSet.add(req.id);
  }

  const questionIdSet = new Set<string>();
  for (const q of kit.questions) {
    if (questionIdSet.has(q.id)) {
      errors.push({
        path: `questions`,
        message: `Duplicate question id: ${q.id}`,
        code: "DUPLICATE_QUESTION_ID"
      });
    }
    questionIdSet.add(q.id);

    for (const reqId of q.requirement_ids) {
      if (!requirementIdSet.has(reqId)) {
        errors.push({
          path: `questions.${q.id}.requirement_ids`,
          message: `Question references non-existent requirement: ${reqId}`,
          code: "INVALID_REQUIREMENT_REFERENCE"
        });
      }
    }
  }

  const flashcardIdSet = new Set<string>();
  for (const card of kit.flashcards) {
    if (flashcardIdSet.has(card.id)) {
      errors.push({
        path: `flashcards`,
        message: `Duplicate flashcard id: ${card.id}`,
        code: "DUPLICATE_FLASHCARD_ID"
      });
    }
    flashcardIdSet.add(card.id);

    for (const reqId of card.requirement_ids) {
      if (!requirementIdSet.has(reqId)) {
        errors.push({
          path: `flashcards.${card.id}.requirement_ids`,
          message: `Flashcard references non-existent requirement: ${reqId}`,
          code: "INVALID_REQUIREMENT_REFERENCE"
        });
      }
    }
  }

  if (kit.schedule.days.length !== kit.schedule.days_available) {
    errors.push({
      path: `schedule.days`,
      message: `Schedule day count (${kit.schedule.days.length}) does not match days_available (${kit.schedule.days_available})`,
      code: "SCHEDULE_DAY_COUNT_MISMATCH"
    });
  }

  const scheduledQuestionIds = new Set<string>();
  kit.schedule.days.forEach((day, index) => {
    const expectedDayNumber = index + 1;
    if (day.day !== expectedDayNumber) {
      errors.push({
        path: `schedule.days[${index}].day`,
        message: `Expected day number ${expectedDayNumber} but got ${day.day}`,
        code: "INVALID_DAY_SEQUENCE"
      });
    }

    if (!Number.isInteger(day.minutes) || day.minutes < 0) {
      errors.push({
        path: `schedule.days[${index}].minutes`,
        message: `Day minutes must be a non-negative integer`,
        code: "INVALID_MINUTES_VALUE"
      });
    }

    for (const qid of day.question_ids) {
      if (!questionIdSet.has(qid)) {
        errors.push({
          path: `schedule.days[${index}].question_ids`,
          message: `Scheduled question id does not exist: ${qid}`,
          code: "INVALID_QUESTION_REFERENCE"
        });
      }
      scheduledQuestionIds.add(qid);
    }
  });

  const questionById = new Map(kit.questions.map((q) => [q.id, q]));
  const coveredRequirementIds = new Set<string>();
  for (const qid of scheduledQuestionIds) {
    const question = questionById.get(qid);
    if (question) {
      for (const reqId of question.requirement_ids) {
        coveredRequirementIds.add(reqId);
      }
    }
  }

  for (const req of kit.role.requirements) {
    if (req.priority === "must" && !coveredRequirementIds.has(req.id)) {
      errors.push({
        path: `coverage`,
        message: `Must-have requirement not covered in schedule: ${req.id} (${req.text})`,
        code: "UNCOVERED_MUST_REQUIREMENT"
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
