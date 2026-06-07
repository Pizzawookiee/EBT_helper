import {
  pgTable,
  uuid,
  timestamp,
  varchar,
  boolean,
  jsonb,
  text,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// intake_sessions
// ---------------------------------------------------------------------------
export const intakeSessions = pgTable("intake_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  /** BCP-47 language tag e.g. "en", "es" */
  language: varchar("language", { length: 10 }).notNull().default("en"),
  /** ContactPreferences JSON */
  contact: jsonb("contact"),
  householdSize: text("household_size"),
  /** IncomeSource[] JSON */
  incomeSources: jsonb("income_sources"),
  /** ExpenseInfo JSON */
  expenseInfo: jsonb("expense_info"),
  /** DocumentStatus[] JSON */
  documents: jsonb("documents"),
  /** NavigatorFlag[] + SensitiveFieldWarning[] JSON */
  flags: jsonb("flags"),
  consentGiven: boolean("consent_given").notNull().default(false),
  /** ISO-8601 timestamp — when this record should be purged */
  deleteAt: timestamp("delete_at"),
});

// ---------------------------------------------------------------------------
// audit_events
// ---------------------------------------------------------------------------
export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => intakeSessions.id, { onDelete: "cascade" }),
  eventType: varchar("event_type", { length: 32 }).notNull(), // view|edit|export|share|delete
  actor: varchar("actor", { length: 255 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  metadata: jsonb("metadata"),
});

// ---------------------------------------------------------------------------
// navigator_tasks
// ---------------------------------------------------------------------------
export const navigatorTasks = pgTable("navigator_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => intakeSessions.id, { onDelete: "cascade" }),
  /** NavigatorFlag[] JSON */
  flags: jsonb("flags"),
  status: varchar("status", { length: 32 }).notNull().default("pending"), // pending|in_progress|resolved
  assignedTo: varchar("assigned_to", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  note: text("note"),
});

// ---------------------------------------------------------------------------
// packets
// ---------------------------------------------------------------------------
export const packets = pgTable("packets", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => intakeSessions.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 16 }).notNull(), // applicant|worker
  /** ApplicantPacket or WorkerPacket JSON */
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  exportedAt: timestamp("exported_at"),
  deleteAt: timestamp("delete_at"),
});
