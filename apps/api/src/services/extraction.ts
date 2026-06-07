/**
 * Structured extraction service.
 *
 * Calls OpenAI chat completions to extract structured IntakeSession fields
 * from a conversation transcript. Uses Zod for output validation.
 *
 * IMPORTANT: This service does NOT make eligibility determinations,
 * benefit amount estimates, or provide legal advice.
 */

import OpenAI from "openai";
import { z } from "zod";
import type {
  HouseholdInfo,
  IncomeInfo,
  ExpenseInfo,
  DocumentStatus,
  AccommodationNeeds,
} from "@ebt/types";
import { getConfig } from "../config";

// ---------------------------------------------------------------------------
// Zod schemas for validated extraction output
// ---------------------------------------------------------------------------

const HouseholdMemberSchema = z.object({
  slot: z.number(),
  ageRange: z.enum(["0-5", "6-17", "18-59", "60+"]).optional(),
  relationshipToApplicant: z.string().optional(),
});

const HouseholdSchema = z.object({
  householdSize: z.number().int().min(1).max(20),
  members: z.array(HouseholdMemberSchema),
  includesPregnant: z.boolean().optional(),
  includesElderlyOrDisabled: z.boolean().optional(),
});

const IncomeSourceSchema = z.object({
  type: z.enum([
    "employment",
    "self_employment",
    "unemployment",
    "social_security",
    "ssi",
    "child_support",
    "other",
    "none",
  ]),
  description: z.string().optional(),
  frequency: z.enum(["weekly", "biweekly", "monthly", "irregular"]).optional(),
});

const IncomeSchema = z.object({
  sources: z.array(IncomeSourceSchema),
  reportedZeroIncome: z.boolean(),
});

const ExpenseSchema = z.object({
  expenses: z.array(
    z.object({
      type: z.enum([
        "rent_mortgage",
        "utilities",
        "medical",
        "childcare",
        "child_support_paid",
        "other",
      ]),
      description: z.string().optional(),
    })
  ),
  hasShelterDeduction: z.boolean().optional(),
});

const DocumentStatusSchema = z.object({
  docType: z.enum([
    "id_proof",
    "residency_proof",
    "income_proof",
    "expense_proof",
    "citizenship_status",
    "social_security_card",
    "other",
  ]),
  available: z.boolean(),
  description: z.string().optional(),
});

const AccommodationSchema = z.object({
  needsInterpreter: z.boolean(),
  interpreterLanguage: z.string().optional(),
  needsASL: z.boolean().optional(),
  needsWrittenMaterials: z.boolean().optional(),
  otherAccommodation: z.string().optional(),
});

const ExtractionOutputSchema = z.object({
  household: HouseholdSchema.nullable(),
  income: IncomeSchema.nullable(),
  expenses: ExpenseSchema.nullable(),
  documents: z.array(DocumentStatusSchema),
  accommodation: AccommodationSchema.nullable(),
  missedInterview: z.boolean(),
  possibleExpedited: z.boolean(),
  needsDTAConnectHelp: z.boolean(),
  needsLanguageSupport: z.boolean(),
});

export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>;

// ---------------------------------------------------------------------------
// Extraction function
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a data extraction assistant for a SNAP (food assistance) intake system.
Extract structured information from the transcript of a caller preparing for a DTA appointment.

CRITICAL RULES:
- Do NOT make any eligibility determinations or benefit amount estimates.
- Do NOT provide legal advice.
- Do NOT store or include EBT PINs, SSNs, bank passwords, or account numbers — the transcript is pre-redacted but verify.
- Only extract what was explicitly stated; leave fields null/empty if not mentioned.
- Set missedInterview=true if the caller mentioned no successful contact with DTA and no reschedule.
- Set possibleExpedited=true if caller mentions urgent need, homelessness, very low/no income, or recent job loss.

Return ONLY valid JSON matching the schema. No prose, no markdown.`;

const EXTRACTION_SCHEMA_DESCRIPTION = `{
  "household": { "householdSize": number, "members": [...], "includesPregnant": bool, "includesElderlyOrDisabled": bool } | null,
  "income": { "sources": [...], "reportedZeroIncome": bool } | null,
  "expenses": { "expenses": [...], "hasShelterDeduction": bool } | null,
  "documents": [...],
  "accommodation": { "needsInterpreter": bool, ... } | null,
  "missedInterview": bool,
  "possibleExpedited": bool,
  "needsDTAConnectHelp": bool,
  "needsLanguageSupport": bool
}`;

export async function extractFromTranscript(
  transcriptLines: string[],
  language: string
): Promise<ExtractionOutput> {
  const config = getConfig();
  const openai = new OpenAI({ apiKey: config.openaiApiKey });

  const transcriptText = transcriptLines.join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `Language: ${language}\n\nTranscript:\n${transcriptText}\n\n` +
          `Return JSON matching this schema:\n${EXTRACTION_SCHEMA_DESCRIPTION}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`OpenAI returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  const result = ExtractionOutputSchema.safeParse(parsed);
  if (!result.success) {
    console.error("Extraction schema validation failed:", result.error.issues);
    // Return safe defaults rather than throwing
    return {
      household: null,
      income: null,
      expenses: null,
      documents: [],
      accommodation: null,
      missedInterview: false,
      possibleExpedited: false,
      needsDTAConnectHelp: false,
      needsLanguageSupport: false,
    };
  }

  return result.data;
}
