import { z } from "zod";

export const RequirementKindSchema = z.enum(["technical", "behavioural", "domain"]);
export type RequirementKind = z.infer<typeof RequirementKindSchema>;

export const RequirementPrioritySchema = z.enum(["must", "nice"]);
export type RequirementPriority = z.infer<typeof RequirementPrioritySchema>;

export const RequirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: RequirementKindSchema,
  priority: RequirementPrioritySchema,
  evidence: z.string().optional()
});
export type Requirement = z.infer<typeof RequirementSchema>;

export const RoleSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(RequirementSchema)
});
export type Role = z.infer<typeof RoleSchema>;

export const SourceSchema = z.object({
  company: z.string(),
  company_url: z.string(),
  role: z.string(),
  location: z.string(),
  jd_chars: z.number().int().nonnegative(),
  researched_at: z.string(),
  pages_used: z.array(z.string())
});
export type Source = z.infer<typeof SourceSchema>;

export const CompanyBriefSchema = z.object({
  summary: z.string(),
  what_they_do: z.string(),
  sources: z.array(z.string()),
  edited_fields: z.array(z.string()).optional()
});
export type CompanyBrief = z.infer<typeof CompanyBriefSchema>;

export const QuestionCategorySchema = z.enum([
  "technical",
  "behavioural",
  "system-design",
  "company-fit"
]);
export type QuestionCategory = z.infer<typeof QuestionCategorySchema>;

export const ItemOriginSchema = z.enum(["generated", "user", "fallback"]);
export type ItemOrigin = z.infer<typeof ItemOriginSchema>;

export const QuestionSchema = z.object({
  id: z.string().min(1),
  requirement_ids: z.array(z.string()),
  category: QuestionCategorySchema,
  prompt: z.string().min(1),
  answer_outline: z.string().min(1),
  difficulty: z.number().int().min(1).max(3),
  origin: ItemOriginSchema.optional(),
  edited: z.boolean().optional(),
  pinned: z.boolean().optional()
});
export type Question = z.infer<typeof QuestionSchema>;

export const FlashcardSchema = z.object({
  id: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string()),
  origin: ItemOriginSchema.optional(),
  edited: z.boolean().optional(),
  pinned: z.boolean().optional()
});
export type Flashcard = z.infer<typeof FlashcardSchema>;

export const ScheduleDaySchema = z.object({
  day: z.number().int().positive(),
  focus: z.string(),
  question_ids: z.array(z.string()),
  minutes: z.number().int().nonnegative()
});
export type ScheduleDay = z.infer<typeof ScheduleDaySchema>;

export const ScheduleSchema = z.object({
  days_available: z.number().int().positive(),
  days: z.array(ScheduleDaySchema)
});
export type Schedule = z.infer<typeof ScheduleSchema>;

export const CoverageSchema = z.object({
  uncovered_requirement_ids: z.array(z.string()),
  passes: z.number().int().nonnegative()
});
export type Coverage = z.infer<typeof CoverageSchema>;

export const WarningSchema = z.object({
  code: z.string(),
  message: z.string()
});
export type Warning = z.infer<typeof WarningSchema>;

export const CrawledPageRecordSchema = z.object({
  url: z.string(),
  kind: z.enum(["hiring", "about", "other"]),
  status: z.enum(["fetched", "skipped", "failed"]),
  reason: z.string().nullable().optional()
});
export type CrawledPageRecord = z.infer<typeof CrawledPageRecordSchema>;

export const DiscussionSourceSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string()
});
export type DiscussionSource = z.infer<typeof DiscussionSourceSchema>;

export const DiscussionRecordSchema = z.object({
  status: z.enum(["found", "none_found", "failed"]),
  sources: z.array(DiscussionSourceSchema)
});
export type DiscussionRecord = z.infer<typeof DiscussionRecordSchema>;

export const ProcessRoundSchema = z.object({
  name: z.string(),
  format: z.string(),
  detail: z.string(),
  evidence: z.string().optional(),
  source_url: z.string().optional()
});
export type ProcessRound = z.infer<typeof ProcessRoundSchema>;

export const ProcessRecordSchema = z.object({
  found: z.boolean(),
  rounds: z.array(ProcessRoundSchema),
  notes: z.string().optional()
});
export type ProcessRecord = z.infer<typeof ProcessRecordSchema>;

export const ResearchRecordSchema = z.object({
  pages: z.array(CrawledPageRecordSchema).default([]),
  discussion: DiscussionRecordSchema.optional(),
  hiring_process: ProcessRecordSchema.optional()
});
export type ResearchRecord = z.infer<typeof ResearchRecordSchema>;

export const IdCountersSchema = z.object({
  r: z.number().int().nonnegative().default(0),
  q: z.number().int().nonnegative().default(0),
  f: z.number().int().nonnegative().default(0)
});
export type IdCounters = z.infer<typeof IdCountersSchema>;

export const KitSchema = z.object({
  source: SourceSchema,
  company_brief: CompanyBriefSchema,
  role: RoleSchema,
  questions: z.array(QuestionSchema),
  flashcards: z.array(FlashcardSchema),
  schedule: ScheduleSchema,
  coverage: CoverageSchema,
  warnings: z.array(WarningSchema).optional(),
  research: ResearchRecordSchema.optional(),
  id_counters: IdCountersSchema.optional()
});
export type Kit = z.infer<typeof KitSchema>;


export const BatchCaseInputSchema = z.object({
  id: z.string().min(1),
  jd: z.string().min(1),
  company_url: z.string().min(1),
  days: z.number().int().positive()
});
export type BatchCaseInput = z.infer<typeof BatchCaseInputSchema>;

export const BatchCaseErrorSchema = z.object({
  code: z.string(),
  message: z.string()
});
export type BatchCaseError = z.infer<typeof BatchCaseErrorSchema>;

export const BatchCaseResultSchema = z.object({
  id: z.string(),
  status: z.enum(["ok", "failed"]),
  kit: KitSchema.nullable(),
  error: BatchCaseErrorSchema.nullable()
});
export type BatchCaseResult = z.infer<typeof BatchCaseResultSchema>;

export const BatchOutputSchema = z.object({
  version: z.string(),
  generated_at: z.string(),
  kits: z.array(BatchCaseResultSchema)
});
export type BatchOutput = z.infer<typeof BatchOutputSchema>;
