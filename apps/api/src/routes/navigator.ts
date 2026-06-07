/**
 * Navigator queue and task management routes.
 *
 * GET   /navigator/queue          — list pending tasks with session summaries
 * PATCH /navigator/tasks/:id      — update task status / assignment / note
 */

import { Router, Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { navigatorTasks, intakeSessions, auditEvents } from "../db/schema";
import { v4 as uuidv4 } from "uuid";
import type { NavigatorQueueItem } from "@ebt/types";
import { NavigatorFlag } from "@ebt/types";

export const navigatorRouter = Router();

// GET /navigator/queue
navigatorRouter.get("/queue", async (req: Request, res: Response) => {
  try {
    const db = getDb();

    const tasks = await db
      .select({
        task: navigatorTasks,
        session: intakeSessions,
      })
      .from(navigatorTasks)
      .innerJoin(intakeSessions, eq(navigatorTasks.sessionId, intakeSessions.id))
      .where(sql`${navigatorTasks.status} != 'resolved'`)
      .orderBy(navigatorTasks.createdAt)
      .limit(100);

    const queue: NavigatorQueueItem[] = tasks.map(({ task, session }) => {
      const flags = (task.flags as string[]) ?? [NavigatorFlag.NORMAL];
      const topFlag = prioritizeFlag(flags);
      return {
        task: {
          id: task.id,
          sessionId: task.sessionId,
          flags: flags as NavigatorFlag[],
          status: task.status as "pending" | "in_progress" | "resolved",
          assignedTo: task.assignedTo ?? null,
          createdAt: task.createdAt.toISOString(),
          updatedAt: task.updatedAt.toISOString(),
          note: task.note ?? undefined,
        },
        sessionSummary: {
          language: session.language,
          householdSize: session.householdSize ? parseInt(session.householdSize, 10) : null,
          createdAt: session.createdAt.toISOString(),
          topFlag,
        },
      };
    });

    res.json({ queue });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch navigator queue" });
  }
});

// PATCH /navigator/tasks/:id
navigatorRouter.patch("/tasks/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const allowedFields: ("status" | "assignedTo" | "note")[] = [
      "status",
      "assignedTo",
      "note",
    ];

    const update: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of allowedFields) {
      if (field in req.body) {
        update[field] = req.body[field];
      }
    }

    // Validate status value if provided
    const validStatuses = ["pending", "in_progress", "resolved"];
    if (update.status && !validStatuses.includes(update.status as string)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    await db.update(navigatorTasks).set(update).where(eq(navigatorTasks.id, id));

    // Fetch updated task for audit
    const [task] = await db
      .select()
      .from(navigatorTasks)
      .where(eq(navigatorTasks.id, id))
      .limit(1);

    if (task) {
      await db.insert(auditEvents).values({
        id: uuidv4(),
        sessionId: task.sessionId,
        eventType: "edit",
        actor: (req.headers["x-navigator-id"] as string) || "unknown",
        metadata: { taskId: id, updatedFields: Object.keys(update) },
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update navigator task" });
  }
});

// ---------------------------------------------------------------------------
// Helper: prioritize the most urgent flag for display
// ---------------------------------------------------------------------------
function prioritizeFlag(flags: string[]): NavigatorFlag {
  const priority: NavigatorFlag[] = [
    NavigatorFlag.SENSITIVE_LEGAL,
    NavigatorFlag.MISSED_INTERVIEW,
    NavigatorFlag.POSSIBLE_EXPEDITED,
    NavigatorFlag.NEEDS_LANGUAGE_SUPPORT,
    NavigatorFlag.NEEDS_DTA_CONNECT_HELP,
    NavigatorFlag.NORMAL,
  ];
  for (const p of priority) {
    if (flags.includes(p)) return p;
  }
  return NavigatorFlag.NORMAL;
}
