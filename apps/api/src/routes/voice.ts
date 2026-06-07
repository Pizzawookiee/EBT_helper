/**
 * Twilio webhook handlers for inbound voice calls.
 *
 * POST /voice/inbound  — start session, play disclosure, language menu
 * POST /voice/gather   — handle DTMF/speech gather results
 * POST /voice/status   — call status callbacks (completed, failed, etc.)
 */

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getConfig } from "../config";
import { getOrCreateAgent, removeAgent } from "../services/voice-agent";
import { getDb } from "../db/client";
import { intakeSessions, auditEvents, navigatorTasks } from "../db/schema";
import { extractFromTranscript } from "../services/extraction";
import { NavigatorFlag } from "@ebt/types";
import { eq } from "drizzle-orm";

export const voiceRouter = Router();

// ---------------------------------------------------------------------------
// POST /voice/inbound
// ---------------------------------------------------------------------------
voiceRouter.post("/inbound", async (req: Request, res: Response) => {
  const config = getConfig();
  const db = getDb();

  const callSid: string = req.body?.CallSid ?? uuidv4();
  const sessionId = uuidv4();

  // Create DB record immediately so we have a session to reference
  const retentionDays = config.retention.transcriptRetentionDays;
  const deleteAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

  await db.insert(intakeSessions).values({
    id: sessionId,
    language: "en",
    consentGiven: false,
    deleteAt,
  });

  // Store mapping: callSid -> sessionId in the agent (keyed by callSid for Twilio continuity)
  const agent = getOrCreateAgent(callSid, config.communityOrgName);

  const twiml = agent.getOpeningTwiML();
  res.type("text/xml").send(twiml);
});

// ---------------------------------------------------------------------------
// POST /voice/gather
// ---------------------------------------------------------------------------
voiceRouter.post("/gather", async (req: Request, res: Response) => {
  const config = getConfig();

  const callSid: string = req.body?.CallSid ?? "";
  const speechResult: string = req.body?.SpeechResult ?? "";
  const digits: string = req.body?.Digits ?? "";

  const input = digits || speechResult || "";

  const agent = getOrCreateAgent(callSid, config.communityOrgName);
  const { twiml, stateUpdate } = agent.processInput(input);

  // Persist state updates asynchronously — don't block the TwiML response
  persistStateUpdate(callSid, stateUpdate).catch((err) =>
    console.error("Failed to persist state update:", err)
  );

  res.type("text/xml").send(twiml);
});

// ---------------------------------------------------------------------------
// POST /voice/status
// ---------------------------------------------------------------------------
voiceRouter.post("/status", async (req: Request, res: Response) => {
  const callSid: string = req.body?.CallSid ?? "";
  const callStatus: string = req.body?.CallStatus ?? "";

  if (callStatus === "completed" || callStatus === "failed" || callStatus === "no-answer") {
    await handleCallEnd(callSid, callStatus);
  }

  res.sendStatus(204);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function persistStateUpdate(
  callSid: string,
  stateUpdate: Record<string, unknown>
): Promise<void> {
  // In production this would look up sessionId from callSid via Redis
  // For now, state is persisted when the call ends
  void stateUpdate;
  void callSid;
}

async function handleCallEnd(callSid: string, callStatus: string): Promise<void> {
  const db = getDb();
  const config = getConfig();

  // Retrieve final agent state
  const { getOrCreateAgent: getAgent } = await import("../services/voice-agent");
  const agent = getAgent(callSid, config.communityOrgName);
  const state = agent.getState();

  // Extract structured data from transcript
  let extraction;
  try {
    extraction = await extractFromTranscript(state.transcript, state.language);
  } catch (err) {
    console.error("Extraction failed:", err);
    extraction = null;
  }

  // Determine navigator flags
  const flags: NavigatorFlag[] = [];
  if (extraction?.missedInterview) flags.push(NavigatorFlag.MISSED_INTERVIEW);
  if (extraction?.possibleExpedited) flags.push(NavigatorFlag.POSSIBLE_EXPEDITED);
  if (extraction?.needsDTAConnectHelp) flags.push(NavigatorFlag.NEEDS_DTA_CONNECT_HELP);
  if (extraction?.needsLanguageSupport) flags.push(NavigatorFlag.NEEDS_LANGUAGE_SUPPORT);
  if (state.sensitiveWarnings.length > 0) flags.push(NavigatorFlag.SENSITIVE_LEGAL);
  if (flags.length === 0) flags.push(NavigatorFlag.NORMAL);

  // Find the session by looking for uncompleted sessions — simplified approach
  // In production, callSid -> sessionId mapping would be stored in Redis
  const sessions = await db
    .select()
    .from(intakeSessions)
    .where(eq(intakeSessions.language, state.language))
    .limit(1);

  const sessionId = sessions[0]?.id;
  if (!sessionId) {
    removeAgent(callSid);
    return;
  }

  // Update session record
  await db
    .update(intakeSessions)
    .set({
      language: state.language,
      consentGiven: state.consentGiven,
      incomeSources: extraction?.income?.sources ?? null,
      expenseInfo: extraction?.expenses ?? null,
      documents: extraction?.documents ?? [],
      flags: {
        navigatorFlags: flags,
        sensitiveWarnings: state.sensitiveWarnings,
      },
    })
    .where(eq(intakeSessions.id, sessionId));

  // Create navigator task
  await db.insert(navigatorTasks).values({
    id: uuidv4(),
    sessionId,
    flags,
    status: "pending",
  });

  // Audit event
  await db.insert(auditEvents).values({
    id: uuidv4(),
    sessionId,
    eventType: "edit",
    actor: "system:voice-agent",
    metadata: {
      callSid,
      callStatus,
      stagesCompleted: state.stage,
      guardRailTriggers: state.guardRailTriggerCount,
    },
  });

  removeAgent(callSid);
}
