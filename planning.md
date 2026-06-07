# Massachusetts DTA SNAP Voice Agent Harness With Privacy Guardrails

## Summary

Build a community-org-controlled AI voice agent that helps Massachusetts SNAP applicants prepare for and recover from DTA interview bottlenecks without becoming an unofficial caseworker inbox. The agent collects only minimum necessary information, tells applicants what documents they may need from vetted sources, supports language access for the community-org intake, creates a worker-readable packet, and routes rescheduling through official DTA channels.

Default operating model: an inbound applicant support line. Outbound AI calls are disabled in v1 unless the applicant has given logged prior express consent and the call program has passed TCPA, recording-consent, and caller-ID review.

Official and compliance sources to design around:

- DTA Assistance Line: `877-382-2363`, with workers available Monday-Friday, 8:15am-4:45pm. Source: https://www.mass.gov/guides/how-to-contact-dta
- DTA Connect can show case status, notices, uploaded documents, alerts, and can reschedule certain appointments. Source: https://www.mass.gov/guides/how-to-contact-dta
- DTA offices have staff and interpreters available; DTA must support language access. Sources: https://www.mass.gov/guides/how-to-contact-dta and https://www.masslegalhelp.org/public-benefits-ssi/snap-food-benefits/26-what-if-i-do-not-speak-english
- SNAP decisions are generally due within 30 days after application submission, or within 7 days for households eligible for expedited service. Sources: https://www.fns.usda.gov/snap/qc/timeliness and https://www.fns.usda.gov/snap/state/interview-toolkit/introduction/regulatory
- Massachusetts has strict wire/oral communication interception rules; recording must require explicit logged consent before audio retention. Source: https://malegislature.gov/Laws/GeneralLaws/PartIV/TitleI/Chapter272/Section99
- AI or prerecorded outbound voice calls require prior express consent under TCPA/FCC rules; caller identity and STIR/SHAKEN attestation must be handled before production outbound calling. Sources: https://docs.fcc.gov/public/attachments/FCC-24-17A1_Rcd.pdf and https://www.law.cornell.edu/cfr/text/47/64.6301

## Roles And MVP Scope

- Applicant: the person seeking SNAP help; controls whether packets are shared externally.
- Community navigator: trained staff member who reviews AI outputs, handles exceptions, and helps applicants use official DTA channels.
- DTA/SNAP worker: official decision-maker; reviews information only through applicant submission or an approved partner workflow.
- AI agent: intake and preparation assistant; never determines eligibility, calculates final benefits, impersonates DTA, or logs into DTA Connect.

MVP includes inbound voice prep, multilingual intake, applicant packet generation, navigator review, and missed-interview recovery tasks. MVP excludes direct DTA system integration, automatic duplicate applications, official notices, eligibility decisions, and outbound AI calling.

## Core Flow

- Start with language and accessibility:
  - Ask: "What language do you prefer?"
  - Ask whether the applicant needs accessibility support such as relay/TTY, ASL/video support, slow speech, repeated summaries, or a trusted helper on the call.
  - Use AI interpretation for the community-org prep call only after consent.
  - Tell the applicant DTA can provide an official interpreter for the DTA interview; the AI does not replace DTA's official interpreter unless DTA formally allows it.
- Identify scope, call direction, and consent:
  - State whether this is an inbound applicant-initiated call or a consented outbound callback.
  - Say: "I am an AI assistant working with [Community Org], not DTA. I can help you prepare, organize documents, and find official next steps. I cannot approve benefits or make eligibility decisions."
  - Say: "Please do not share your EBT PIN, bank passwords, full SSN, DTA Connect password, or account logins."
  - Ask for explicit consent to continue the AI-assisted intake.
  - Ask separately for recording/transcript consent before retaining raw audio or transcripts. If recording consent is not given, process the call ephemerally and store only the structured packet after applicant confirmation.
- Bind the session without over-authentication:
  - Create or resume a record using phone number, preferred name, date of birth month/year or another low-risk verifier, safe callback preference, and a one-time SMS/voice code when available.
  - If the applicant has no DTA Agency ID or case ID, do not force collection of SSN; mark the record as "no DTA ID yet."
  - For dropped calls, resume only after verifying the low-risk session binding fields.
- Confirm application timeline as variables:
  - Application submission date.
  - Application submission method, such as DTA Connect, paper, phone, kiosk, or outreach partner.
  - Whether DTA confirmation was received and how.
  - Scheduled or expected interview date/time, if any.
  - Whether DTA called, whether the applicant reached a human, and whether a reschedule notice was received.
  - Whether the applicant has DTA Connect access, a DTA Agency ID, case ID, application number, or a notice.
  - Do not recommend duplicate reapplication by default; instead help track status, call DTA, use DTA Connect, visit an office, or escalate through approved channels.
- Prepare applicant using source-grounded guidance:
  - Generate document guidance only from a vetted DTA/SNAP knowledge base, not free-form LLM guesses.
  - Each checklist item must cite its source category, such as DTA notice, DTA Connect status, official DTA document list, or navigator-confirmed local practice.
  - If a document need is uncertain, label it "may be useful" rather than "required."
  - Generate questions/script for calling DTA.
  - Generate an applicant-held summary packet in the applicant's preferred language and English when useful for DTA.
- If no DTA worker is available:
  - Try official reschedule paths only if available in DTA Connect or another approved DTA workflow.
  - If automatic reschedule is not supported, create a navigator task and give official options: DTA Assistance Line, DTA Connect, local DTA office, or approved outreach partner route.
  - If possible expedited-service indicators are present, explain that eligible expedited SNAP households should receive benefits within 7 days and route to navigator review immediately.
  - Do not create a new application just to get a new call slot unless a human navigator confirms that is appropriate.

## Information To Extract

- Safe/basic information:
  - Preferred language and output language.
  - Accessibility needs, including interpreter, relay/TTY, ASL, trusted helper, or safe-contact limitations.
  - Best callback number and safe contact times.
  - Whether voicemail/text/email are safe.
  - Consent state: AI intake consent, recording/transcript consent, SMS consent, outbound callback consent, and external-sharing authorization.
  - Application submission date and method.
  - Whether DTA confirmation was received.
  - Whether applicant has DTA Agency ID, case ID, application number, or notice.
  - Whether applicant has DTA Connect access, without collecting login credentials.
  - Interview date/time, missed call details, hold/disconnect history, and reschedule attempts.
- SNAP-prep information:
  - Household size and relationships, without collecting unnecessary full identifiers.
  - Current income sources and approximate pay frequency.
  - Rent/mortgage, utilities, dependent care, and medical expenses for elderly/disabled household members.
  - Possible expedited-service indicators, including very low income/resources, urgent food need, migrant/seasonal farmworker circumstances, housing instability, or inability to wait for normal processing.
  - Documents already available and documents missing.
  - Contradictions or uncertainty that require worker/navigator review.
- High-sensitivity information to avoid or minimize:
  - Full SSN: avoid in AI flow; use last four only if truly needed for applicant-owned tracking.
  - Immigration details: ask only broad routing questions and escalate to human/legal navigator where needed.
  - Bank account details: do not collect account numbers or credentials.
  - Medical details: collect only expense category/amount for SNAP prep, not diagnosis unless volunteered and necessary.
- Forbidden information:
  - EBT card PIN.
  - Bank passwords or portal passwords.
  - Full payment card numbers.
  - DTA Connect username/password or other login credentials.
  - Any information not needed for SNAP interview preparation.

## Outputs

- Applicant packet:
  - One-page plain-language summary.
  - Output in the applicant's preferred language, plus English when useful for DTA or navigator review.
  - "What to say when calling DTA" script.
  - Source-grounded document checklist with "required by notice," "commonly requested," and "may be useful" labels.
  - Timeline using collected variables, for example: "Applied [date] via [method]; interview expected/scheduled [date/time]; [call outcome]; [reschedule status]."
  - Official next steps with DTA Assistance Line, DTA Connect, local office, and navigator support.
- Worker-readable packet:
  - "Prepared by applicant with assistance from [Community Org]; not an eligibility determination."
  - Household/income/expense summary.
  - Missing verification checklist with source labels.
  - Possible expedited-service/accommodation flags, including the 7-day expedited timeline as a review flag, not a promise of approval.
  - Missed-interview/reschedule issue.
  - Confidence labels: confirmed by document, applicant-reported, uncertain, needs worker review.
- Navigator queue:
  - Normal prep complete.
  - Needs DTA Connect help.
  - Needs language/accommodation support.
  - Missed interview/no reschedule.
  - Possible expedited-service urgency.
  - Sensitive/immigration/legal issue requiring human review.
  - Live human handoff requested or required.

## Privacy, Compliance, And Security Guardrails

- Applicant controls sharing:
  - Default: packet stays with applicant.
  - Community org shares externally only with explicit authorization.
  - If the org is a contracted SNAP outreach partner, use DTA's approved permission/share process.
- Consent:
  - Log AI intake consent before collecting SNAP-prep information.
  - Log recording/transcript consent separately before retaining raw audio or transcript.
  - Log SMS consent before sending reminders.
  - Log prior express consent before any outbound AI voice callback.
  - Include revocation paths for SMS, outbound calls, storage, and external sharing.
- Call identity and outbound controls:
  - Inbound line is the default MVP.
  - For any outbound call, use registered business caller ID, branded calling where available, STIR/SHAKEN-capable provider configuration, and a callback path to the published community-org number.
  - Monitor carrier labeling such as "Scam Likely" and maintain number reputation before scaling.
- Minimum necessary collection:
  - Collect enough to prepare for interview, not enough to impersonate or fully authenticate the applicant.
  - Do not store raw audio by default.
  - Store structured fields and packet only unless the applicant opts into transcript retention.
- Vendor retention:
  - Require zero-data-retention or no-training configurations for voice AI, STT/TTS, telephony, logging, analytics, and storage vendors where available.
  - Execute DPAs/security addenda that cover audio, transcripts, metadata, and support access.
  - Document each vendor's independent retention limits; do not promise deletion that the vendor contract cannot honor.
- Retention:
  - Raw audio: off by default; if enabled, delete within 30 days.
  - Transcript: delete within 30 days unless applicant opts into navigator follow-up.
  - Prep packet/case record: delete within 90 days unless ongoing help is requested.
  - Audit logs: retain for at least 1 year in de-identified or minimally identifying form after case deletion; preserve event type, actor, timestamp, and case pseudonym, but remove packet contents and unnecessary PII.
- Access and encryption:
  - Assigned navigator access only, enforced with RBAC and SSO or strong MFA.
  - Audit every view, edit, export, share, deletion, and consent change.
  - Mask sensitive fields by default.
  - Encrypt Postgres fields containing PII using application-layer or field-level encryption.
  - Store keys in a managed KMS/secrets manager with rotation and least-privilege access.
  - Encrypt object storage and backups; test restore and deletion behavior.
- Real-time secret handling:
  - Detect phrases indicating EBT PINs, passwords, SSNs, or credentials during the call and interrupt before the applicant continues.
  - Run post-call PII/secret scrubbing before transcript storage.
  - If a forbidden secret is captured, redact it, mark an incident event, and delete affected raw artifacts when possible.
- AI safety:
  - No eligibility determinations.
  - No benefit amount estimates unless clearly labeled as non-official and separately approved.
  - No legal advice.
  - AI-generated summaries require human navigator review before agency-facing use.
  - Document checklists and DTA next-step guidance must be generated from the vetted knowledge base with citations.
  - No applicant data used for model training.
- Anti-scam language:
  - Every call identifies the community org.
  - Agent says DTA will not ask for EBT PINs by text, and the community org will not ask either.
  - If applicant is unsure, tell them to hang up and call official DTA channels.

## Stack

- Voice: Twilio Programmable Voice or equivalent, with multilingual speech support, STIR/SHAKEN support, caller ID reputation monitoring, and recording controls.
- AI: realtime voice model for conversation plus separate structured extraction into validated JSON.
- Knowledge base: vetted DTA/SNAP source repository for document guidance, DTA contact information, hours, language-access notes, expedited-service timelines, and missed-interview recovery scripts. Treat DTA phone numbers and hours as config with source URLs and last-verified dates.
- Frontend: Next.js/TypeScript navigator dashboard with packet review, live handoff queue, consent history, source citations, and export controls.
- Backend: Node.js/TypeScript with typed schemas for intake, consent, session binding, packets, source citations, audit events, and retention jobs.
- Data: Postgres with field-level encryption for structured records, encrypted object storage only if transcripts/audio are retained, Redis for call/session state, immutable/minimized audit log store.
- Workflow:
  - Reminder jobs.
  - Navigator review queue.
  - Live handoff task queue.
  - DTA call-attempt/reschedule task queue.
  - Retention/deletion jobs for cases and separately retained audit logs.
  - Packet export with audit logging.

## Test Plan

- Generic Massachusetts timeline scenario:
  - Applicant submits through DTA Connect on a configurable application date.
  - Interview is scheduled or expected on a configurable date.
  - Applicant does not reach a human.
  - No reschedule is received.
  - No DTA Agency ID is available.
  - Expected result: no duplicate application recommendation by default; create missed-interview recovery packet and navigator task.
- Regression scenario using motivating facts:
  - Application submitted May 27 through DTA Connect.
  - Interview/call expected June 1.
  - Applicant did not reach a human, was never rescheduled, and has no DTA Agency ID.
  - Expected result: generated timeline packet uses those facts as case data, not hardcoded product text.
- Expedited-service scenario:
  - Applicant reports possible expedited indicators.
  - Expected result: packet flags 7-day expedited review path, routes to navigator, and avoids promising eligibility or approval.
- Language and accessibility scenario:
  - Applicant requests Spanish, Haitian Creole, Portuguese, Mandarin, Arabic, relay/TTY, ASL/video, or a trusted helper.
  - Expected result: AI conducts community-org prep in preferred language where supported, creates translated outputs, and reminds applicant DTA can provide official interpreter support.
  - Haitian Creole and other lower-resource languages require ASR/TTS feasibility testing before launch.
- Consent and call-direction scenario:
  - Inbound caller consents to AI intake but declines recording.
  - Expected result: no raw audio retention; structured packet only after applicant confirmation.
  - Outbound callback attempted without prior express consent.
  - Expected result: callback is blocked and navigator task is created.
- Privacy scenario:
  - Applicant gives EBT PIN or bank password.
  - Expected result: agent interrupts, refuses to store it, explains safety, redacts from transcript, and incident event is logged.
- Source-grounding scenario:
  - Agent is asked which documents are "required."
  - Expected result: only DTA notice or vetted-source-backed requirements are labeled required; uncertain items are labeled "may be useful."
- Security scenario:
  - Navigator attempts to view an unassigned case.
  - Expected result: access denied and audit event created.
  - Case deletion occurs at 90 days.
  - Expected result: packet and PII are deleted, while minimized audit trail remains.
- Worker bottleneck scenario:
  - Normal case produces applicant-held packet only.
  - Urgent/missed-interview case creates navigator task.
  - Agency contact uses only approved channels.
- Quality metrics:
  - Percent of applicants who complete packets.
  - Percent with source-grounded document checklist generated.
  - Navigator edit rate.
  - Missed-interview recovery rate.
  - Expedited-service flag precision and false-positive review rate.
  - Number of unnecessary agency contacts avoided.
  - Number of duplicate applications avoided.
  - Counterfactual comparison against similar navigator-supported applicants without the AI harness.

## Assumptions

- First implementation targets Massachusetts DTA SNAP workflows.
- The community org controls the AI and does not have direct DTA system access unless separately authorized.
- SNAP/DTA official review happens only when the applicant submits the packet through official channels or a formal DTA/community-partner workflow exists.
- Automatic rescheduling is limited to official DTA-supported mechanisms; otherwise the system creates a navigator follow-up task.
- Inbound voice is the v1 default; outbound AI calls require separate compliance approval, consent capture, and caller-ID readiness.

## Four-Contributor Implementation Plan

The repo currently contains a monorepo scaffold with `apps/api` and `apps/web`. The API already has route/service boundaries for voice intake, extraction, privacy, packet generation, sessions, navigator tasks, retention, reminders, config, and Drizzle schema. The web app has a package scaffold but no visible app source yet. The API imports `@ebt/types`, but no `packages/types` package exists in the repo yet; creating that shared package is the first cross-team dependency.

### Shared Contract For All Contributors

- Create `packages/types` as `@ebt/types` before feature work begins.
- Define shared TypeScript types and Zod schemas for:
  - `SupportedLanguage`: `en | es | pt | ht | zh | vi | ar` for MVP, with unsupported languages routed to navigator review.
  - `IntakeStage`: `LANGUAGE_SELECT | CONSENT | RECORDING_CONSENT | SESSION_BINDING | SCOPE_ID | TIMELINE | PREP | DOCUMENTS | WRAP_UP | COMPLETED | ABANDONED`.
  - `ConsentState`: AI intake consent, recording/transcript consent, SMS consent, outbound callback consent, external sharing authorization, revocation timestamps.
  - `SessionBinding`: phone number hash, preferred name, safe callback preference, optional one-time code verification, optional DTA Agency ID or application/case reference.
  - `ApplicationTimeline`: application date, method, confirmation status, expected/scheduled interview date, call outcome, reschedule status, DTA ID status.
  - `HouseholdInfo`, `IncomeInfo`, `ExpenseInfo`, `DocumentStatus`, `AccommodationNeeds`, `SensitiveFieldWarning`, `NavigatorFlag`, `ApplicantPacket`, `WorkerPacket`, `NavigatorTask`, `AuditEvent`, and `SourceCitation`.
- Shared API response shape:
  - Successful responses return `{ data: ... }`.
  - Errors return `{ error: { code: string, message: string, details?: unknown } }`.
  - All PII-bearing responses must be redacted by default unless a navigator has assigned-case access.
- Shared acceptance gate:
  - `npm run build` passes for all workspaces.
  - Any new endpoint has request/response schemas, validation, and at least one happy-path and one privacy/safety test.

### Contributor 1: Voice Intake And Consent

Owns inbound call behavior in `apps/api/src/routes/voice.ts` and `apps/api/src/services/voice-agent.ts`.

Features:

- Implement inbound-only MVP call flow with explicit stage transitions:
  - Language selection.
  - AI intake consent.
  - Separate recording/transcript consent.
  - Session binding for new/resumed calls.
  - Application timeline collection.
  - Household/income/expense/document prompts.
  - Wrap-up with official DTA next steps.
- Replace in-memory-only call state with Redis-backed `callSid -> sessionId` mapping.
- Store incremental state updates instead of waiting until call end.
- Add dropped-call resume behavior using low-risk session binding fields.
- Add live handoff trigger when the caller asks for a person, refuses AI, has accessibility needs the bot cannot support, or hits high-risk privacy/legal flags.
- Keep outbound voice disabled except for a blocked/stub path that verifies prior express consent and creates a navigator task instead of placing the call.

Inputs:

- Twilio webhook body: `CallSid`, `From`, `To`, `CallStatus`, `SpeechResult`, `Digits`.
- Config: community org name, DTA contact config, retention settings, supported languages, Redis URL.
- Existing or new session binding record.

Outputs:

- TwiML responses for every stage.
- Updated `intake_sessions` fields: language, consent state, contact preferences, session binding summary, application timeline, transcript-retention mode.
- `audit_events` for consent, stage changes, dropped-call resume, guardrail triggers, and handoff requests.
- `navigator_tasks` for missed interview, possible expedited service, DTA Connect help, language/accessibility need, live handoff, sensitive/legal issue, and outbound-call blocked.

Acceptance criteria:

- A caller can complete the full intake without raw audio retention.
- A caller who declines recording still gets a structured packet path.
- A dropped call can resume without asking for full SSN or DTA login credentials.
- A caller who says an EBT PIN/password is interrupted before the agent continues and the value is not stored in plain text.

### Contributor 2: Extraction, Knowledge Base, And Packets

Owns `apps/api/src/services/extraction.ts`, `apps/api/src/services/packet.ts`, and the new source-grounded knowledge-base layer.

Features:

- Replace free-form document guidance with a vetted DTA/SNAP knowledge base:
  - Store source entries with URL, title, last-verified date, jurisdiction, category, and plain-language guidance.
  - Treat DTA phone numbers, hours, DTA Connect URL, office URL, expedited timeline, interpreter notes, and common document categories as configurable sourced records.
  - Generate checklist items only from source records or applicant-provided DTA notices.
- Extend extraction to return:
  - Application timeline fields.
  - Consent-independent facts.
  - Possible expedited indicators with reason codes.
  - Document availability and uncertainty labels.
  - Accommodation needs and output-language preference.
  - Contradictions/uncertainties requiring navigator review.
- Add packet generation with source citations:
  - Applicant packet in preferred language and English when needed.
  - Worker-readable packet with confidence labels and "not an eligibility determination" disclaimer.
  - DTA call script using configured/sourced DTA contact info, not hardcoded text.
- Add hallucination controls:
  - Any item not backed by a source citation must be labeled `uncertain` or omitted.
  - "Required" may only be used when backed by a DTA notice or vetted official source.

Inputs:

- Redacted transcript lines and structured session state.
- Vetted knowledge-base records.
- Applicant-reported document statuses.
- Navigator-edited corrections.

Outputs:

- `ExtractionOutput` JSON validated by Zod.
- `ApplicantPacket` JSON with summary, timeline, checklist, call script, next steps, language, and source citations.
- `WorkerPacket` JSON with household/income/expense summaries, missing verifications, flags, confidence labels, and source citations.
- Packet records in `packets`.
- Audit events for packet generation, navigator edit, export, and source version used.

Acceptance criteria:

- The motivating May 27/June 1 scenario appears only as case data, not hardcoded packet text.
- A checklist cannot call a document "required" without a source citation.
- Possible expedited service flags mention the 7-day review path as a review flag, not a promise of approval.
- Packet generation still works when the applicant has no DTA Agency ID.

### Contributor 3: Privacy, Security, Data Model, And Jobs

Owns `apps/api/src/db/schema.ts`, `apps/api/src/services/privacy.ts`, `apps/api/src/jobs/retention.ts`, `apps/api/src/jobs/reminders.ts`, and API-wide auth/audit middleware.

Features:

- Update schema for the shared contract:
  - Add consent fields, session binding fields, application timeline fields, accommodation fields, source citations, and packet review status.
  - Split minimized audit logs from case records so audit survives case deletion without retaining packet content or unnecessary PII.
  - Add assignment fields needed for RBAC.
- Implement privacy and security controls:
  - Field-level encryption or application-layer encryption for PII-bearing Postgres fields.
  - KMS/secrets-manager integration abstraction.
  - RBAC middleware requiring assigned navigator access for session/packet reads.
  - SSO/MFA-ready auth abstraction, with `x-navigator-id` allowed only in local/dev mode.
  - PII masking by default in list responses.
- Harden secret detection:
  - Real-time phrase detection for EBT PIN, full SSN, DTA Connect password, bank password, account login, and payment credentials.
  - Post-call transcript scrub before storage.
  - Incident audit event when forbidden secrets are captured.
- Implement retention:
  - Raw audio off by default.
  - Transcript deletion at 30 days unless consented follow-up requires shorter/longer configured retention.
  - Packet/case deletion at 90 days unless ongoing help is active.
  - Minimized audit retention for at least 1 year after case deletion.
- Implement reminder/privacy-safe notification jobs:
  - Stale navigator task reminders without PII in logs.
  - Deletion reminders and completed deletion audit events.

Inputs:

- Session, packet, consent, and task data from API services.
- Environment config for retention, encryption, auth mode, and vendor retention mode.
- Navigator identity and assignment information.

Outputs:

- Drizzle schema and migrations for the agreed data contract.
- Authenticated/redacted API responses.
- Audit events for view, edit, export, share, delete, consent change, assignment, and incident.
- Retention job results that delete PII while preserving minimized audit records.

Acceptance criteria:

- Deleting a case removes packet contents and PII but preserves a minimized audit trail.
- An unassigned navigator cannot view a session or packet.
- List endpoints do not expose detailed PII.
- Forbidden secrets are redacted before transcript storage and never appear in logs.

### Contributor 4: Navigator Web App And Workflow UX

Owns `apps/web` and the navigator-facing workflow that consumes the API.

Features:

- Build navigator dashboard views:
  - Queue view grouped by urgency: possible expedited, missed interview/no reschedule, live handoff, language/accessibility, DTA Connect help, sensitive/legal, normal prep.
  - Session detail view with masked PII, consent state, timeline, extracted facts, uncertainty flags, and source citations.
  - Packet review/editor for applicant packet and worker-readable packet.
  - Export/share flow that requires explicit applicant authorization and records destination/channel.
  - Live handoff panel for callers who need a human.
  - Deletion/revocation controls for applicant requests.
- Build frontend guardrails:
  - Show disclaimers that packet is not an eligibility determination.
  - Block export until navigator review is complete and sharing authorization exists.
  - Show source citations beside checklist items.
  - Warn when an applicant may have expedited-service indicators.
  - Use compact operational UI, not a landing page.
- Define API consumption:
  - `GET /navigator/queue` for work queue.
  - `PATCH /navigator/tasks/:id` for assignment/status/note.
  - `GET /sessions/:id` for detail.
  - `PATCH /sessions/:id` for navigator corrections.
  - Add packet endpoints if missing: `POST /sessions/:id/packets`, `GET /sessions/:id/packets`, `PATCH /packets/:id/review`, `POST /packets/:id/export`.

Inputs:

- Navigator identity/auth context.
- Queue items, sessions, tasks, packets, audit summaries, consent states, and source citations from the API.
- Navigator edits and review decisions.

Outputs:

- Reviewed applicant and worker packets.
- Task assignments, notes, and status changes.
- Export/share events with channel, destination type, consent reference, and timestamp.
- Applicant deletion/revocation requests sent to API.

Acceptance criteria:

- A navigator can triage the queue without seeing unnecessary PII.
- A navigator can review and approve a packet before export.
- Export is blocked without sharing authorization.
- Possible expedited and missed-interview cases are visually prioritized.
- The UI supports translated applicant outputs and English worker/navigator review.

### Integration Milestones

- Milestone 1: shared `@ebt/types` package compiles; API imports resolve; web can import queue/session/packet types.
- Milestone 2: inbound call creates a session, captures consent, stores session binding, and creates a navigator task.
- Milestone 3: extraction and packet generation produce source-grounded applicant/worker packets for a redacted transcript.
- Milestone 4: navigator dashboard can review, edit, approve, and export a packet with audit logging.
- Milestone 5: retention, deletion, RBAC, secret redaction, and consent revocation pass privacy test scenarios.
- Milestone 6: end-to-end demo covers the configurable May 27/June 1 missed-interview scenario without duplicate reapplication, with an applicant packet, worker packet, and navigator task.
