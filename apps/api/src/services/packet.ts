/**
 * Packet generation service.
 *
 * Generates ApplicantPacket and WorkerPacket from a completed IntakeSession.
 *
 * IMPORTANT:
 * - All AI-generated summaries in WorkerPacket require human navigator review
 *   before any agency-facing use.
 * - No eligibility determinations or benefit estimates are made.
 * - DTA contact info is hardcoded — never AI-generated.
 */

import { v4 as uuidv4 } from "uuid";
import type {
  IntakeSession,
  ApplicantPacket,
  WorkerPacket,
  DTACallScript,
  DocumentChecklistItem,
  ApplicantTimeline,
  ApplicantNextSteps,
  HouseholdSummary,
  IncomeSummary,
  ExpenseSummary,
  MissingVerification,
  WorkerPacketFlags,
} from "@ebt/types";
import { ConfidenceLevel, NavigatorFlag } from "@ebt/types";

// ---------------------------------------------------------------------------
// Hardcoded DTA contact information — NEVER AI-generated
// ---------------------------------------------------------------------------

const DTA_ASSISTANCE_LINE = "877-382-2363" as const;
const DTA_CONNECT_URL = "https://dtaconnect.eohhs.mass.gov" as const;

function buildDTACallScript(session: IntakeSession): DTACallScript {
  const script: string[] = [
    `1. Call the DTA Assistance Line at ${DTA_ASSISTANCE_LINE} (Mon–Fri, 8:15 AM – 4:45 PM).`,
    `2. Say your name and that you are calling about your SNAP application.`,
    `3. Have your case number or date of birth ready to verify your identity.`,
    `4. Ask about the status of your application${session.household?.householdSize ? ` for ${session.household.householdSize} people` : ""}.`,
    `5. If you need to reschedule an interview, ask to reschedule with a DTA worker.`,
    `6. If you need language assistance, you may request a free interpreter.`,
    `7. Do NOT share your EBT PIN with anyone during this call.`,
    `8. After the call, note the worker's name and call reference number.`,
  ];

  return {
    dtaAssistanceLine: DTA_ASSISTANCE_LINE,
    dtaConnectUrl: DTA_CONNECT_URL,
    localOfficeNote:
      "Find your local DTA office at mass.gov/dta or ask your navigator for the nearest office.",
    script,
  };
}

function buildDocumentChecklist(session: IntakeSession): DocumentChecklistItem[] {
  const standard: DocumentChecklistItem[] = [
    {
      docType: "Photo ID",
      description: "State ID, driver's license, or passport",
      available: false,
      actionNeeded: "Obtain from RMV or use another government-issued ID",
    },
    {
      docType: "Proof of Address",
      description: "Utility bill, lease, or mail with current address",
      available: false,
      actionNeeded: "Gather recent mail or a signed statement from landlord",
    },
    {
      docType: "Proof of Income",
      description: "Pay stubs, benefit award letters, or employer contact",
      available: false,
      actionNeeded: "Request recent pay stubs or employer letter",
    },
  ];

  // Overlay with what the caller reported
  for (const doc of session.documents) {
    const existing = standard.find(
      (s) => s.docType.toLowerCase().includes(doc.docType.replace(/_/g, " ").toLowerCase())
    );
    if (existing) {
      existing.available = doc.available;
      if (doc.available) existing.actionNeeded = undefined;
      if (doc.description) existing.description = doc.description;
    }
  }

  return standard;
}

// ---------------------------------------------------------------------------
// Public: generateApplicantPacket
// ---------------------------------------------------------------------------

export function generateApplicantPacket(session: IntakeSession): ApplicantPacket {
  const houseSize = session.household?.householdSize ?? "unknown number of";

  const summary =
    `This summary was prepared by your navigator to help you at your DTA appointment. ` +
    `Your household of ${houseSize} person(s) has gathered information about income, expenses, ` +
    `and documents. Review the checklist below and bring all available documents to your interview. ` +
    `Remember: this summary is for your preparation only — DTA makes all final decisions.`;

  const nextSteps: ApplicantNextSteps = {
    immediate: [
      "Gather all documents on the checklist below.",
      "Confirm your interview date and time with DTA.",
      "Contact your navigator if you need help before your interview.",
    ],
    ifNoResponse: [
      `Call DTA Assistance Line at ${DTA_ASSISTANCE_LINE} to check your case status.`,
      "Ask your navigator to help you connect with DTA Connect online.",
      "Do NOT reapply unless DTA tells you to — ask about your existing application first.",
    ],
    resourceContacts: [
      { label: "DTA Assistance Line", phone: DTA_ASSISTANCE_LINE },
      { label: "DTA Connect (online portal)", url: DTA_CONNECT_URL },
      { label: "Local DTA Office", url: "https://www.mass.gov/snap-offices" },
    ],
  };

  return {
    id: uuidv4(),
    sessionId: session.id,
    generatedAt: new Date().toISOString(),
    summary,
    dtaCallScript: buildDTACallScript(session),
    documentChecklist: buildDocumentChecklist(session),
    timeline: buildTimeline(session),
    nextSteps,
    language: session.language,
  };
}

function buildTimeline(session: IntakeSession): ApplicantTimeline {
  return {
    applicationDate: undefined, // Populated by navigator from session notes
    interviewDate: undefined,
    expectedDecisionDate: undefined,
    notes: [
      "DTA must process a complete SNAP application within 30 days.",
      "If you may qualify for expedited benefits, DTA should act within 7 days.",
      "Your navigator can provide more information about your specific timeline.",
    ],
  };
}

// ---------------------------------------------------------------------------
// Public: generateWorkerPacket
// ---------------------------------------------------------------------------

export function generateWorkerPacket(session: IntakeSession): WorkerPacket {
  const flags = session.flags as string[];

  const missingVerifications: MissingVerification[] = [];
  if (!session.income) {
    missingVerifications.push({
      field: "income",
      reason: "Income information was not collected",
      suggestedDocument: "Pay stubs or benefit award letter",
    });
  }
  if (!session.household) {
    missingVerifications.push({
      field: "household",
      reason: "Household composition not confirmed",
      suggestedDocument: "Birth certificates or lease agreement listing household members",
    });
  }
  const hasIdDoc = session.documents.some(
    (d) => d.docType === "id_proof" && d.available
  );
  if (!hasIdDoc) {
    missingVerifications.push({
      field: "id_proof",
      reason: "No photo ID confirmed available",
      suggestedDocument: "State ID, driver's license, or passport",
    });
  }

  const workerFlags: WorkerPacketFlags = {
    expeditedServiceIndicator: flags.includes(NavigatorFlag.POSSIBLE_EXPEDITED),
    missedInterview: flags.includes(NavigatorFlag.MISSED_INTERVIEW),
    accommodationNeeded:
      flags.includes(NavigatorFlag.NEEDS_LANGUAGE_SUPPORT) ||
      !!session.accommodation?.needsInterpreter ||
      !!session.accommodation?.needsASL,
    sensitiveOrImmigrationFlagged:
      flags.includes(NavigatorFlag.SENSITIVE_LEGAL) ||
      session.sensitiveFieldWarnings.length > 0,
  };

  return {
    id: uuidv4(),
    sessionId: session.id,
    generatedAt: new Date().toISOString(),
    disclaimer:
      "NAVIGATOR USE ONLY — All AI-generated summaries require human navigator review " +
      "before any agency-facing use. This is NOT an eligibility determination.",
    householdSummary: buildHouseholdSummary(session),
    incomeSummary: buildIncomeSummary(session),
    expenseSummary: buildExpenseSummary(session),
    missingVerifications,
    flags: workerFlags,
    navigatorFlags: flags,
    language: session.language,
  };
}

function buildHouseholdSummary(session: IntakeSession): HouseholdSummary {
  const h = session.household;
  return {
    householdSize: {
      value: h?.householdSize ?? 0,
      confidence: h ? ConfidenceLevel.MEDIUM : ConfidenceLevel.MISSING,
      note: h ? undefined : "Household size not collected — follow up required",
    },
    memberDetails: {
      value: h
        ? h.members.map((m) => `Slot ${m.slot}: ${m.ageRange ?? "age unknown"}`).join("; ")
        : "Not collected",
      confidence: h?.members.length ? ConfidenceLevel.LOW : ConfidenceLevel.MISSING,
      note: "AI-extracted — verify with applicant",
    },
    includesElderlyOrDisabled: {
      value: h?.includesElderlyOrDisabled ?? false,
      confidence: h ? ConfidenceLevel.MEDIUM : ConfidenceLevel.MISSING,
    },
    includesPregnant: {
      value: h?.includesPregnant ?? false,
      confidence: h ? ConfidenceLevel.MEDIUM : ConfidenceLevel.MISSING,
    },
  };
}

function buildIncomeSummary(session: IntakeSession): IncomeSummary {
  const inc = session.income;
  return {
    sources: {
      value: inc?.sources.map((s) => s.type) ?? [],
      confidence: inc ? ConfidenceLevel.MEDIUM : ConfidenceLevel.MISSING,
      note: "AI-extracted — verify against documents",
    },
    reportedZeroIncome: {
      value: inc?.reportedZeroIncome ?? false,
      confidence: inc ? ConfidenceLevel.MEDIUM : ConfidenceLevel.MISSING,
    },
    incomeNote: {
      value: inc
        ? `${inc.sources.length} income source(s) reported`
        : "Income information not collected",
      confidence: ConfidenceLevel.LOW,
      note: "Requires document verification",
    },
  };
}

function buildExpenseSummary(session: IntakeSession): ExpenseSummary {
  const exp = session.expenses;
  return {
    expenseTypes: {
      value: exp?.expenses.map((e) => e.type) ?? [],
      confidence: exp ? ConfidenceLevel.MEDIUM : ConfidenceLevel.MISSING,
    },
    hasShelterDeduction: {
      value: exp?.hasShelterDeduction ?? false,
      confidence: exp ? ConfidenceLevel.MEDIUM : ConfidenceLevel.MISSING,
    },
    expenseNote: {
      value: exp
        ? `${exp.expenses.length} expense type(s) reported`
        : "Expense information not collected",
      confidence: ConfidenceLevel.LOW,
      note: "Requires document verification",
    },
  };
}
