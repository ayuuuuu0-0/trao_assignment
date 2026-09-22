import { z } from "zod";
import {
  Role,
  Requirement,
  RequirementKind,
  RequirementPriority,
  Warning,
} from "../schema/kit.js";
import {
  wrapUntrusted,
  UNTRUSTED_DATA_SYSTEM_INSTRUCTION,
} from "../llm/wrapUntrusted.js";
import { ILlmClient } from "../llm/types.js";

export const RawRequirementItemSchema = z.object({
  text: z.string().min(1),
  kind: z.enum(["technical", "behavioural", "domain"]),
  priority: z.enum(["must", "nice"]),
  evidence: z.string().min(1),
});

export const RawExtractionSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  location: z.string(),
  company: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(RawRequirementItemSchema),
});

export type RawExtraction = z.infer<typeof RawExtractionSchema>;

export interface ExtractionResult {

  role: Role;
  sourceDetails: {
    company: string;
    location: string;
    title: string;
    seniority: string;
  };
  warnings: Warning[];
}

const EXTRACTION_SYSTEM_PROMPT = `${UNTRUSTED_DATA_SYSTEM_INSTRUCTION}

You are an expert technical recruiter analyzing a job posting.
Extract structured information accurately from the provided job description data.

Rules:
1. Return valid JSON adhering strictly to the required schema.
2. For any field not explicitly stated in the job description, return an empty string "" or empty array []. Never guess or invent company names, titles, or locations.
3. Responsibilities ("You will design APIs", "Leading sprint planning") go in "responsibilities".
4. Requirements ("5+ years of React", "Experience with Kafka", "Excellent communication skills") go in "requirements".
5. Each requirement MUST include a verbatim "evidence" excerpt from the job description text.
6. Kind mapping:
   - "technical": Programming languages, frameworks, cloud infrastructure, databases, architectures.
   - "behavioural": Mentoring, leadership, communication, teamwork, ownership.
   - "domain": Industry-specific regulations or domain knowledge (e.g. HIPAA, PCI-DSS, fintech, trading).
7. Priority mapping (D5):
   - "must": Items listed under headings like "Requirements", "Qualifications", "Must Have", or using words like "required", "must", "essential", "minimum", or concrete experience requirements ("5+ years").
   - "nice": Items listed under headings like "Nice to Have", "Bonus", "Preferred", "Plus", or using words like "bonus", "preferred", "ideally", "familiarity with", "exposure to".
8. When in doubt, extract fewer requirements rather than inventing requirements not explicitly stated in the text.`;

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Checks if the evidence string exists in the job description text.
 * Uses normalized comparison to be resilient to minor whitespace or quote differences.
 */
export function isGrounded(evidence: string, jdText: string): boolean {
  if (!evidence.trim()) return false;
  const normEvidence = normalizeText(evidence);
  const normJd = normalizeText(jdText);
  return normJd.includes(normEvidence);
}

const NICE_HEADINGS = ["nice to have", "bonus", "preferred", "plus", "extra credit", "what would be great", "bonus points"];
const MUST_HEADINGS = ["requirements", "qualifications", "what you need", "must have", "minimum", "basic qualifications", "what you'll need", "what you will need"];

const NICE_WORDS = ["bonus", "nice to have", "preferred", "a plus", "ideally", "familiarity with", "exposure to", "helpful", "good to have"];
const MUST_WORDS = ["required", "must", "need to", "you will need", "minimum", "essential"];

/**
 * Checks if a line in the JD is an actual section heading rather than body text.
 */
function checkHeadingLine(line: string): "must" | "nice" | null {
  const trimmed = line.trim();
  // Headings are short (typically under 45 characters). Long sentences are body text.
  if (!trimmed || trimmed.length > 45) return null;

  const cleaned = trimmed.toLowerCase().replace(/[:#*_\-]/g, "").trim();

  if (NICE_HEADINGS.some((h) => cleaned === h || cleaned.startsWith(`${h} `) || cleaned.endsWith(` ${h}`))) {
    return "nice";
  }
  if (MUST_HEADINGS.some((h) => cleaned === h || cleaned.startsWith(`${h} `) || cleaned.endsWith(` ${h}`))) {
    return "must";
  }
  return null;
}

/**
 * Determines the priority of a requirement deterministically using D5 rules.
 */
export function determinePriority(
  evidence: string,
  modelPriority: RequirementPriority,
  jdText: string
): RequirementPriority {
  const normEvidence = evidence.toLowerCase();

  // 1. Evidence cue words: explicit "bonus" / "helpful" / "preferred" words take high precedence.
  if (NICE_WORDS.some((w) => normEvidence.includes(w))) {
    return "nice";
  }

  // 2. Find the location of this evidence in the JD to check the preceding section heading.
  const idx = jdText.toLowerCase().indexOf(normEvidence);
  if (idx !== -1) {
    const precedingText = jdText.slice(0, idx);
    const lines = precedingText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    // Scan backwards for the closest real heading line.
    for (let i = lines.length - 1; i >= Math.max(0, lines.length - 15); i--) {
      const headingKind = checkHeadingLine(lines[i]!);
      if (headingKind) {
        return headingKind;
      }
    }
  }

  // 3. Evidence mandatory cue words ("required", "must", "essential").
  if (MUST_WORDS.some((w) => normEvidence.includes(w))) {
    return "must";
  }

  // 4. Default: fallback to model's classification.
  return modelPriority;
}


export async function extractRequirements(
  jd: string,
  llmClient: ILlmClient
): Promise<ExtractionResult> {
  const userPrompt = `Extract requirements and role details from the following job description:\n\n${wrapUntrusted("job-description", jd)}`;

  const raw = await llmClient.generateJson(
    { system: EXTRACTION_SYSTEM_PROMPT, user: userPrompt },
    RawExtractionSchema
  );

  const warnings: Warning[] = [];
  const groundedRequirements: Requirement[] = [];
  const seenTexts = new Set<string>();

  let counter = 1;

  for (const item of raw.requirements) {
    // 1. Grounding check: drop if evidence is not found in the original JD text.
    if (!isGrounded(item.evidence, jd)) {
      continue;
    }

    // 2. Deduplicate.
    const norm = normalizeText(item.text);
    if (seenTexts.has(norm)) {
      continue;
    }
    seenTexts.add(norm);

    // 3. Priority override according to D5 mapping.
    const priority = determinePriority(item.evidence, item.priority, jd);

    groundedRequirements.push({
      id: `r${counter++}`,
      text: item.text.trim(),
      kind: item.kind,
      priority,
      evidence: item.evidence.trim(),
    });
  }

  // 4. Cap at 25 requirements, prioritizing 'must' requirements.
  let finalRequirements = groundedRequirements;
  if (finalRequirements.length > 25) {
    const musts = finalRequirements.filter((r) => r.priority === "must");
    const nices = finalRequirements.filter((r) => r.priority === "nice");
    finalRequirements = [...musts, ...nices].slice(0, 25);
  }

  // 5. Thin job description detection.
  if (jd.length < 300 || finalRequirements.length < 3) {
    warnings.push({
      code: "THIN_JOB_DESCRIPTION",
      message: `Only ${finalRequirements.length} requirements could be extracted from ${jd.length} characters.`,
    });
  }

  return {
    role: {
      title: raw.title.trim(),
      seniority: raw.seniority.trim(),
      responsibilities: raw.responsibilities.map((r) => r.trim()).filter(Boolean),
      requirements: finalRequirements,
    },
    sourceDetails: {
      company: raw.company.trim(),
      location: raw.location.trim(),
      title: raw.title.trim(),
      seniority: raw.seniority.trim(),
    },
    warnings,
  };
}
