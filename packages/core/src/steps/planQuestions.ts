import { Role, QuestionCategory, CompanyBrief, ProcessRecord } from "../schema/kit.js";

export type QuestionPlan = Record<QuestionCategory, number>;

const SENIOR_TIERS = ["senior", "staff", "lead", "principal", "architect", "head"];

/**
 * Deterministically computes question counts per category according to Skill 33 / Section 6.9.
 * This demonstrates responsive sequencing derived from research rather than arbitrary prompts.
 */
export function planQuestions(
  role: Role,
  process: ProcessRecord,
  companyBrief: CompanyBrief
): QuestionPlan {
  // 1. Technical plan
  const techMusts = role.requirements.filter(
    (r) => (r.kind === "technical" || r.kind === "domain") && r.priority === "must"
  ).length;
  const techNices = role.requirements.filter(
    (r) => (r.kind === "technical" || r.kind === "domain") && r.priority === "nice"
  ).length;

  let techCount = Math.min(12, techMusts * 2 + techNices * 1);
  const hasTakeHomeOrCoding = process.rounds.some(
    (r) => r.format === "take-home" || r.format === "coding"
  );
  if (hasTakeHomeOrCoding) {
    techCount = Math.min(14, techCount + 2);
  }
  if (techMusts + techNices > 0 && techCount === 0) {
    techCount = 2;
  }

  // 2. Behavioural plan
  const behavMusts = role.requirements.filter(
    (r) => r.kind === "behavioural" && r.priority === "must"
  ).length;
  const behavNices = role.requirements.filter(
    (r) => r.kind === "behavioural" && r.priority === "nice"
  ).length;

  let behavCount = Math.min(8, behavMusts * 2 + behavNices * 1);
  const hasBehavRound = process.rounds.some(
    (r) => r.format === "behavioural" || r.format === "panel"
  );
  if (hasBehavRound) {
    behavCount = Math.min(10, behavCount + 2);
  }
  // Guarantee at least 2 behavioural questions
  behavCount = Math.max(2, behavCount);

  // 3. System Design plan
  let sysDesignCount = 0;
  const hasSysDesignRound = process.rounds.some((r) => r.format === "system-design");
  const isSeniorRole = SENIOR_TIERS.some((tier) =>
    role.seniority.toLowerCase().includes(tier) || role.title.toLowerCase().includes(tier)
  );

  if (hasSysDesignRound || (isSeniorRole && techMusts > 0)) {
    sysDesignCount = 3;
  }

  // 4. Company Fit plan
  let companyFitCount = 2;
  if (companyBrief.sources && companyBrief.sources.length > 0) {
    companyFitCount = 3;
  }

  return {
    technical: techCount,
    behavioural: behavCount,
    "system-design": sysDesignCount,
    "company-fit": companyFitCount,
  };
}
