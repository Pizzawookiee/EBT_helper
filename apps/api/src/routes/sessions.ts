/**
 * REST CRUD for intake sessions (navigator use only).
 *
 * GET    /sessions          — list sessions (paginated)
 * GET    /sessions/:id      — get session by ID
 * PATCH  /sessions/:id      — update session fields
 * DELETE /sessions/:id      — soft-delete (mark delete_at = now)
 */

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { intakeSessions, auditEvents } from "../db/schema";

export const sessionsRouter = Router();

// GET /sessions
sessionsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const rows = await db.select().from(intakeSessions).limit(50);
    res.json({ sessions: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

// GET /sessions/:id
sessionsRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const [session] = await db
      .select()
      .from(intakeSessions)
      .where(eq(intakeSessions.id, req.params.id))
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Audit: view
    await db.insert(auditEvents).values({
      id: uuidv4(),
      sessionId: session.id,
      eventType: "view",
      actor: (req.headers["x-navigator-id"] as string) || "unknown",
      metadata: { ip: req.ip },
    });

    res.json(session);
  } catch (err) {
    res.status(500).json({ error: "Failed to get session" });
  }
});

// PATCH /sessions/:id
sessionsRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    // Whitelist updatable fields — sensitive fields are blocked
    const allowedFields: (keyof typeof intakeSessions.$inferInsert)[] = [
      "language",
      "contact",
      "householdSize",
      "incomeSources",
      "expenseInfo",
      "documents",
      "flags",
      "consentGiven",
    ];

    const update: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of allowedFields) {
      if (field in req.body) {
        update[field] = req.body[field];
      }
    }

    await db.update(intakeSessions).set(update).where(eq(intakeSessions.id, id));

    // Audit: edit
    await db.insert(auditEvents).values({
      id: uuidv4(),
      sessionId: id,
      eventType: "edit",
      actor: (req.headers["x-navigator-id"] as string) || "unknown",
      metadata: { updatedFields: Object.keys(update) },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update session" });
  }
});

// DELETE /sessions/:id — soft delete
sessionsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    await db
      .update(intakeSessions)
      .set({ deleteAt: new Date() })
      .where(eq(intakeSessions.id, id));

    // Audit: delete
    await db.insert(auditEvents).values({
      id: uuidv4(),
      sessionId: id,
      eventType: "delete",
      actor: (req.headers["x-navigator-id"] as string) || "unknown",
      metadata: { reason: req.body?.reason ?? "navigator_request" },
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete session" });
  }
});
