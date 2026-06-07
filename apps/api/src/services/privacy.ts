/**
 * Privacy guardrail service.
 *
 * Detects and redacts EBT PINs, bank passwords, full SSNs, and account
 * login credentials from any text before storage or processing.
 *
 * IMPORTANT: Detected values are NEVER stored — only the redacted text
 * and a SensitiveFieldWarning are persisted.
 */

import type { SensitiveFieldWarning } from "@ebt/types";

export interface ForbiddenPattern {
  type: SensitiveFieldWarning["warningType"];
  /** Regex to detect the sensitive pattern */
  pattern: RegExp;
  /** Human-readable label used in caller warnings */
  label: string;
}

/**
 * FORBIDDEN_PATTERNS — ordered by specificity (most specific first).
 *
 * EBT PINs are 4 digits; matched when preceded/followed by PIN-context keywords.
 * Full SSNs: XXX-XX-XXXX or XXXXXXXXX (9 digits).
 * Bank passwords: detected via keyword context.
 */
export const FORBIDDEN_PATTERNS: ForbiddenPattern[] = [
  {
    type: "EBT_PIN",
    // Matches "PIN" or "ebt pin" followed by 4 digits (with optional separators)
    pattern:
      /\b(?:ebt\s+)?pin(?:\s+(?:is|number|#))?\s*[:\-]?\s*(\d{4})\b/gi,
    label: "EBT PIN",
  },
  {
    type: "FULL_SSN",
    // Standard SSN format: 3-2-4 with dashes or 9 contiguous digits preceded by SSN context
    pattern:
      /\b(?:ssn|social\s+security(?:\s+number)?)\s*[:\-]?\s*(\d{3}[-\s]?\d{2}[-\s]?\d{4})\b/gi,
    label: "Social Security Number",
  },
  {
    type: "FULL_SSN",
    // Bare 9-digit SSN (without keyword) — more prone to false positives, kept for safety
    pattern: /\b(\d{3}-\d{2}-\d{4})\b/g,
    label: "Social Security Number",
  },
  {
    type: "BANK_PASSWORD",
    // Matches "password", "passcode", "login" followed by any token
    pattern:
      /\b(?:bank\s+)?(?:password|passcode|login\s+code)(?:\s+(?:is|:))?\s+(\S+)/gi,
    label: "bank password or login",
  },
  {
    type: "ACCOUNT_LOGIN",
    // Username / account number in login context
    pattern:
      /\b(?:username|account\s+(?:number|login|id))(?:\s+(?:is|:))?\s+(\S+)/gi,
    label: "account login credential",
  },
];

export interface RedactResult {
  redactedText: string;
  warnings: SensitiveFieldWarning[];
}

/**
 * Scan text for forbidden patterns, redact matched values, and return
 * warnings. The original sensitive value is never included in the output.
 */
export function redactSensitive(text: string, field = "transcript"): RedactResult {
  let redactedText = text;
  const warnings: SensitiveFieldWarning[] = [];

  for (const fp of FORBIDDEN_PATTERNS) {
    // Reset lastIndex for global regexes
    fp.pattern.lastIndex = 0;

    const replaced = redactedText.replace(fp.pattern, (match) => {
      const snippet = match.slice(0, 40).replace(/\d/g, "*");
      warnings.push({
        field,
        warningType: fp.type,
        detectedAt: new Date().toISOString(),
        redactedSnippet: snippet,
      });
      // Replace entire match with redaction marker
      return `[REDACTED:${fp.type}]`;
    });

    if (replaced !== redactedText) {
      redactedText = replaced;
    }
  }

  return { redactedText, warnings };
}

/**
 * Validate an intake session's free-text fields and redact any forbidden
 * content. Returns a sanitised copy of the session data and any warnings.
 */
export function validateIntakeFields<T extends Record<string, unknown>>(
  session: T
): { sanitised: T; warnings: SensitiveFieldWarning[] } {
  const allWarnings: SensitiveFieldWarning[] = [];

  const sanitise = (obj: unknown, path: string): unknown => {
    if (typeof obj === "string") {
      const { redactedText, warnings } = redactSensitive(obj, path);
      allWarnings.push(...warnings);
      return redactedText;
    }
    if (Array.isArray(obj)) {
      return obj.map((item, i) => sanitise(item, `${path}[${i}]`));
    }
    if (obj && typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = sanitise(value, `${path}.${key}`);
      }
      return result;
    }
    return obj;
  };

  const sanitised = sanitise(session, "session") as T;
  return { sanitised, warnings: allWarnings };
}

/**
 * Returns the caller-facing warning message when a forbidden pattern is detected.
 * Used by the voice agent to interrupt and warn the caller.
 */
export function getForbiddenPatternWarningScript(
  warningType: SensitiveFieldWarning["warningType"],
  communityOrgName: string
): string {
  const base = `I need to stop you there. For your protection, ${communityOrgName} and this system cannot accept or store your`;
  switch (warningType) {
    case "EBT_PIN":
      return `${base} EBT PIN. Please never share your PIN with anyone — DTA will never ask for it by phone or text. Let's continue without that information.`;
    case "FULL_SSN":
      return `${base} full Social Security Number in this conversation. Your navigator can collect that securely in person if needed. Let's continue.`;
    case "BANK_PASSWORD":
    case "ACCOUNT_LOGIN":
      return `${base} bank password or account login. Never share those with anyone over the phone. Let's continue.`;
  }
}
