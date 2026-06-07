/**
 * Stateful voice conversation manager.
 *
 * Manages the intake conversation stages and generates TwiML responses.
 * Privacy guardrails are applied to every transcript segment before storage.
 *
 * DISCLOSURES (must appear in every call):
 * - Community org name (from config)
 * - "I am an AI assistant, not DTA"
 * - "Do not share EBT PIN, bank passwords, SSN, or account logins"
 * - Anti-scam: "DTA will not ask for your EBT PIN by text"
 *
 * No eligibility determinations, benefit estimates, or legal advice.
 */

import type { IntakeStage, SupportedLanguage, SensitiveFieldWarning } from "@ebt/types";
import { redactSensitive, getForbiddenPatternWarningScript } from "./privacy";

export interface ConversationState {
  sessionId: string;
  stage: IntakeStage;
  language: SupportedLanguage;
  consentGiven: boolean;
  transcript: string[];
  sensitiveWarnings: SensitiveFieldWarning[];
  /** Incremented each time privacy guardrail fires */
  guardRailTriggerCount: number;
}

// ---------------------------------------------------------------------------
// Disclosure scripts
// ---------------------------------------------------------------------------

const ANTI_SCAM_PREFIX = (orgName: string) =>
  `This call is from ${orgName}, a community organization helping you prepare for your SNAP application. ` +
  `We are NOT the Department of Transitional Assistance. ` +
  `DTA will never ask for your EBT PIN by phone or text. ` +
  `Do not share your EBT PIN, bank passwords, Social Security Number, or any account logins with anyone on this call.`;

const AI_DISCLOSURE = (orgName: string) =>
  `I am an AI assistant working for ${orgName}. I am not a DTA employee and I cannot make decisions about your benefits. ` +
  `Nothing I say is legal advice or a determination of eligibility.`;

const CONSENT_SCRIPT = (orgName: string) =>
  `Before we begin, I need your consent. This conversation will be used to help your navigator prepare for your DTA appointment. ` +
  `Your information will be kept confidential and deleted after ${orgName}'s retention period. ` +
  `You can stop at any time. Do you consent to continue? Press 1 for yes, or press 2 to end the call.`;

// ---------------------------------------------------------------------------
// Stage prompts (English — translation is handled by Twilio's <Say> language)
// ---------------------------------------------------------------------------

const STAGE_PROMPTS: Record<IntakeStage, (orgName: string) => string> = {
  LANGUAGE_SELECT: (orgName) =>
    `Welcome to ${orgName}. ` +
    `For English, press 1. Para Español, oprima 2. Para Português, pressione 3. ` +
    `Pour Kreyòl Ayisyen, appuyez sur 4. 按5键选择中文. Để tiếng Việt, bấm 6.`,
  CONSENT: CONSENT_SCRIPT,
  SCOPE_ID: () =>
    `Let's start. Can you tell me roughly when you applied or plan to apply for SNAP benefits? ` +
    `Also, have you already had a DTA interview, or are you still waiting?`,
  TIMELINE: () =>
    `Thank you. To help prepare your documents, I'll ask about your household. ` +
    `How many people, including yourself, live in your home?`,
  PREP: () =>
    `Now let's talk about income. Does anyone in your household have income from a job, ` +
    `benefits like Social Security, or any other source? Please describe generally — ` +
    `do NOT share account numbers or PINs.`,
  DOCUMENTS: () =>
    `Good. Let's go through documents. Do you have a photo ID, proof of address, ` +
    `and proof of income available? Say yes or no for each, or describe what you have.`,
  WRAP_UP: (orgName) =>
    `You're all set. Your navigator from ${orgName} will follow up with you. ` +
    `If you need to call DTA directly, their Assistance Line is 877-382-2363, ` +
    `available Monday through Friday. You can also visit DTA Connect online. ` +
    `Do not share your EBT PIN with anyone. Is there anything else before we finish?`,
  COMPLETED: () => `Thank you. This session is complete. Goodbye.`,
  ABANDONED: () => `Session ended. If you need help, call back anytime. Goodbye.`,
};

const STAGE_ORDER: IntakeStage[] = [
  "LANGUAGE_SELECT",
  "CONSENT",
  "SCOPE_ID",
  "TIMELINE",
  "PREP",
  "DOCUMENTS",
  "WRAP_UP",
  "COMPLETED",
];

// ---------------------------------------------------------------------------
// VoiceAgent class
// ---------------------------------------------------------------------------

export class VoiceAgent {
  private state: ConversationState;
  private communityOrgName: string;

  constructor(sessionId: string, communityOrgName: string) {
    this.communityOrgName = communityOrgName;
    this.state = {
      sessionId,
      stage: "LANGUAGE_SELECT",
      language: "en",
      consentGiven: false,
      transcript: [],
      sensitiveWarnings: [],
      guardRailTriggerCount: 0,
    };
  }

  getState(): Readonly<ConversationState> {
    return { ...this.state };
  }

  /**
   * Process incoming speech/DTMF from the caller.
   * Always run privacy guardrails before storing any transcript segment.
   * Returns the TwiML body string for the next response.
   */
  processInput(rawInput: string): { twiml: string; stateUpdate: Partial<ConversationState> } {
    // --- Privacy guardrail ---
    const { redactedText, warnings } = redactSensitive(rawInput, `stage:${this.state.stage}`);

    if (warnings.length > 0) {
      this.state.sensitiveWarnings.push(...warnings);
      this.state.guardRailTriggerCount += warnings.length;

      // Warn the caller and do NOT advance stage
      const warningScript = getForbiddenPatternWarningScript(
        warnings[0].warningType,
        this.communityOrgName
      );
      return {
        twiml: this.buildTwiML(warningScript, true),
        stateUpdate: {
          sensitiveWarnings: this.state.sensitiveWarnings,
          guardRailTriggerCount: this.state.guardRailTriggerCount,
        },
      };
    }

    // Store redacted transcript segment
    this.state.transcript.push(`[${this.state.stage}] Caller: ${redactedText}`);

    // Handle stage-specific logic
    const nextStage = this.handleStageTransition(redactedText);
    if (nextStage) {
      this.state.stage = nextStage;
    }

    const prompt = this.getCurrentPrompt();
    return {
      twiml: this.buildTwiML(prompt),
      stateUpdate: { stage: this.state.stage, transcript: this.state.transcript },
    };
  }

  /** Generate the opening TwiML for a new call */
  getOpeningTwiML(): string {
    const opening =
      ANTI_SCAM_PREFIX(this.communityOrgName) +
      " " +
      AI_DISCLOSURE(this.communityOrgName) +
      " " +
      STAGE_PROMPTS.LANGUAGE_SELECT(this.communityOrgName);

    return this.buildGatherTwiML(opening, "/voice/gather");
  }

  /** Generate TwiML for the current stage prompt */
  getCurrentPrompt(): string {
    return STAGE_PROMPTS[this.state.stage]?.(this.communityOrgName) ?? "How can I help you?";
  }

  private handleStageTransition(input: string): IntakeStage | null {
    const lower = input.toLowerCase().trim();

    switch (this.state.stage) {
      case "LANGUAGE_SELECT": {
        // DTMF digit selects language
        if (input === "2") this.state.language = "es";
        else if (input === "3") this.state.language = "pt";
        else if (input === "4") this.state.language = "ht";
        else if (input === "5") this.state.language = "zh";
        else if (input === "6") this.state.language = "vi";
        else this.state.language = "en";
        return "CONSENT";
      }

      case "CONSENT": {
        if (input === "1" || lower.includes("yes") || lower.includes("consent")) {
          this.state.consentGiven = true;
          return "SCOPE_ID";
        }
        // No consent — end the call
        this.state.stage = "ABANDONED";
        return "ABANDONED";
      }

      case "SCOPE_ID":
        return "TIMELINE";

      case "TIMELINE":
        return "PREP";

      case "PREP":
        return "DOCUMENTS";

      case "DOCUMENTS":
        return "WRAP_UP";

      case "WRAP_UP":
        return "COMPLETED";

      default:
        return null;
    }
  }

  private buildTwiML(text: string, addCurrentPrompt = false): string {
    const sayLang = this.getTwilioLanguage();
    const followUp = addCurrentPrompt
      ? `\n  <Gather input="speech dtmf" action="/voice/gather" timeout="5">
    <Say language="${sayLang}">${this.escapeXml(this.getCurrentPrompt())}</Say>
  </Gather>`
      : `\n  <Gather input="speech dtmf" action="/voice/gather" timeout="5">
    <Say language="${sayLang}">${this.escapeXml(text)}</Say>
  </Gather>`;

    const warning = addCurrentPrompt
      ? `\n  <Say language="${sayLang}">${this.escapeXml(text)}</Say>`
      : "";

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>${warning}${followUp}
</Response>`;
  }

  private buildGatherTwiML(text: string, action: string): string {
    const lang = this.getTwilioLanguage();
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech dtmf" action="${action}" timeout="5" language="${lang}">
    <Say language="${lang}">${this.escapeXml(text)}</Say>
  </Gather>
</Response>`;
  }

  private getTwilioLanguage(): string {
    const map: Record<string, string> = {
      en: "en-US",
      es: "es-US",
      pt: "pt-BR",
      ht: "fr-CA", // Twilio nearest approximation
      zh: "zh-CN",
      vi: "vi-VN",
      km: "en-US", // Fallback — human interpreter recommended
      so: "en-US", // Fallback — human interpreter recommended
      ar: "ar-SA",
    };
    return map[this.state.language] ?? "en-US";
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}

// ---------------------------------------------------------------------------
// In-memory session store (replace with Redis in production)
// ---------------------------------------------------------------------------

const agentMap = new Map<string, VoiceAgent>();

export function getOrCreateAgent(sessionId: string, communityOrgName: string): VoiceAgent {
  if (!agentMap.has(sessionId)) {
    agentMap.set(sessionId, new VoiceAgent(sessionId, communityOrgName));
  }
  return agentMap.get(sessionId)!;
}

export function removeAgent(sessionId: string): void {
  agentMap.delete(sessionId);
}
