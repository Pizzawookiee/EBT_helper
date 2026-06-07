# Massachusetts DTA SNAP Voice Agent Harness With Privacy Guardrails

## Summary

Build a community-org-controlled AI voice agent that helps Massachusetts SNAP applicants prepare for and recover from DTA interview bottlenecks without becoming an unofficial caseworker inbox. The agent collects only minimum necessary information, tells applicants what documents they may need, supports language access for the community-org intake, creates a worker-readable packet, and routes rescheduling through official DTA channels.

Official channels to design around:

- DTA Assistance Line: `877-382-2363`, with workers available Monday-Friday, 8:15am-4:45pm. Source: https://www.mass.gov/guides/how-to-contact-dta
- DTA Connect can show case status, notices, uploaded documents, alerts, and can reschedule certain appointments. Source: https://www.mass.gov/guides/how-to-contact-dta
- DTA offices have staff and interpreters available; DTA must support language access. Sources: https://www.mass.gov/guides/how-to-contact-dta and https://www.masslegalhelp.org/public-benefits-ssi/snap-food-benefits/26-what-if-i-do-not-speak-english
- SNAP decisions are generally due within 30 days after application submission. Source: https://www.mass.gov/doc/dta-snap-application-standards-signage/download

## Core Flow

- Start with language:
  - "What language do you prefer?"
  - Use AI interpretation for the community-org prep call.
  - Tell the applicant DTA can provide an official interpreter for the DTA interview; the AI does not replace DTA's official interpreter unless DTA formally allows it.
- Identify scope and consent:
  - "I am an AI assistant working with [Community Org], not DTA. I can help you prepare, organize documents, and find official next steps. I cannot approve benefits or make eligibility decisions."
  - "Please do not share your EBT PIN, bank passwords, full SSN, or account logins."
- Confirm application timeline:
  - Application submitted through DTA Connect on May 27.
  - Applicant received confirmation that DTA would contact them for interview.
  - Interview/call expected June 1.
  - Applicant did not reach a human, was not rescheduled, and has no DTA Agency ID/case ID yet.
  - Agent should not recommend duplicate reapplication as the default; instead it should help track status, call DTA, use DTA Connect, visit an office, or escalate through approved channels.
- Prepare applicant:
  - Explain likely documents needed.
  - Generate a document checklist.
  - Generate questions/script for calling DTA.
  - Generate an applicant-held summary packet.
- If no DTA worker is available:
  - Agent attempts official reschedule path only if available in DTA Connect or another approved DTA workflow.
  - If automatic reschedule is not supported, create a navigator task and give the applicant official options: DTA Assistance Line, DTA Connect, local DTA office, or approved outreach partner route.
  - Do not create a new application just to get a new call slot unless a human navigator confirms that is appropriate.

## Information To Extract

- Safe/basic information:
  - Preferred language.
  - Best callback number and safe contact times.
  - Whether voicemail/text/email are safe.
  - Application submission date and method.
  - Whether DTA confirmation was received.
  - Whether applicant has DTA Agency ID, case ID, application number, or notice.
  - Whether applicant has DTA Connect access.
  - Interview date/time, missed call details, hold/disconnect history.
- SNAP-prep information:
  - Household size and relationships, without collecting unnecessary full identifiers.
  - Current income sources and approximate pay frequency.
  - Rent/mortgage, utilities, dependent care, and medical expenses for elderly/disabled household members.
  - Housing instability, no income, very low cash-on-hand, or other possible expedited-service indicators.
  - Documents already available and documents missing.
  - Accommodation needs: language, disability, phone access, safe-contact limitations.
- High-sensitivity information to avoid or minimize:
  - Full SSN: avoid in AI flow; use last four only if truly needed for applicant-owned tracking.
  - Immigration details: ask only broad routing questions and escalate to human/legal navigator where needed.
  - Bank account details: do not collect account numbers or credentials.
  - Medical details: collect only expense category/amount for SNAP prep, not diagnosis unless volunteered and necessary.
- Forbidden information:
  - EBT card PIN.
  - Bank passwords or portal passwords.
  - Full payment card numbers.
  - Login credentials for DTA Connect.
  - Any information not needed for SNAP interview preparation.

## Outputs

- Applicant packet:
  - One-page plain-language summary.
  - "What to say when calling DTA" script.
  - Document checklist.
  - Timeline: "Applied May 27; interview/call expected June 1; no successful human contact; no reschedule received."
  - Official next steps with DTA Assistance Line, DTA Connect, local office, and navigator support.
- Worker-readable packet:
  - "Prepared by applicant with assistance from [Community Org]; not an eligibility determination."
  - Household/income/expense summary.
  - Missing verification checklist.
  - Possible expedited-service/accommodation flags.
  - Missed-interview/reschedule issue.
  - Confidence labels: confirmed by document, applicant-reported, uncertain, needs worker review.
- Navigator queue:
  - Normal prep complete.
  - Needs DTA Connect help.
  - Needs language/accommodation support.
  - Missed interview/no reschedule.
  - Possible expedited-service urgency.
  - Sensitive/immigration/legal issue requiring human review.

## Privacy Guardrails

- Applicant controls sharing:
  - Default: packet stays with applicant.
  - Community org shares externally only with explicit authorization.
  - If the org is a contracted SNAP outreach partner, use DTA's approved permission/share process.
- Minimum necessary collection:
  - Collect enough to prepare for interview, not enough to impersonate or fully authenticate the applicant.
  - Do not store raw audio by default.
  - Store structured fields and packet only.
- Retention:
  - Raw audio: off by default; if enabled, delete within 30 days.
  - Transcript: delete within 30 days unless applicant opts into navigator follow-up.
  - Prep packet/case record: delete within 90 days unless ongoing help is requested.
- Access:
  - Assigned navigator access only.
  - Audit every view, edit, export, and share.
  - Mask sensitive fields by default.
- AI safety:
  - No eligibility determinations.
  - No benefit amount estimates unless clearly labeled as non-official and separately approved.
  - No legal advice.
  - AI-generated summaries require human navigator review before agency-facing use.
  - No applicant data used for model training.
- Anti-scam language:
  - Every call identifies the community org.
  - Agent says DTA will not ask for EBT PINs by text, and the community org will not ask either.
  - If applicant is unsure, tell them to hang up and call official DTA channels.

## Stack

- Voice: Twilio Programmable Voice or equivalent, with multilingual speech support.
- AI: realtime voice model for conversation plus separate structured extraction into validated JSON.
- Frontend: Next.js/TypeScript navigator dashboard.
- Backend: Node.js/TypeScript with typed schemas for intake, consent, packets, and audit events.
- Data: Postgres for structured records, encrypted object storage only if transcripts/audio are retained, Redis for call/session state.
- Workflow:
  - Reminder jobs.
  - Navigator review queue.
  - DTA call-attempt/reschedule task queue.
  - Retention/deletion jobs.
  - Packet export with audit logging.

## Test Plan

- Massachusetts timeline scenario:
  - Applicant applied May 27 through DTA Connect.
  - Interview expected June 1.
  - No human answered.
  - No reschedule received.
  - No DTA Agency ID available.
  - Expected result: no duplicate application recommendation by default; create missed-interview recovery packet and navigator task.
- Language scenario:
  - Applicant requests Spanish, Haitian Creole, Portuguese, Mandarin, or Arabic.
  - Expected result: AI conducts community-org prep in preferred language and reminds applicant DTA can provide official interpreter support.
- Privacy scenario:
  - Applicant gives EBT PIN or bank password.
  - Expected result: agent interrupts, refuses to store it, explains safety, and redacts from transcript.
- Worker bottleneck scenario:
  - Normal case produces applicant-held packet only.
  - Urgent/missed-interview case creates navigator task.
  - Agency contact uses only approved channels.
- Quality metrics:
  - Percent of applicants who complete packets.
  - Percent with document checklist generated.
  - Navigator edit rate.
  - Missed-interview recovery rate.
  - Number of unnecessary agency contacts avoided.
  - Number of duplicate applications avoided.

## Assumptions

- First implementation targets Massachusetts DTA SNAP workflows.
- The community org controls the AI and does not have direct DTA system access unless separately authorized.
- SNAP/DTA official review happens only when the applicant submits the packet through official channels or a formal DTA/community-partner workflow exists.
- Automatic rescheduling is limited to official DTA-supported mechanisms; otherwise the system creates a navigator follow-up task.
