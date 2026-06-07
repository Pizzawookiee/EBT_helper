/**
 * BullMQ retention job.
 *
 * Finds sessions and packets whose delete_at timestamp has passed,
 * deletes the records, and logs an audit event for each deletion.
 *
 * Schedule: run daily (configured in index.ts).
 */

import { Worker, Queue } from "bullmq";
import { sql, lte } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db/client";
import { intakeSessions, packets, auditEvents } from "../db/schema";
import type { ConnectionOptions } from "bullmq";

export const RETENTION_QUEUE_NAME = "retention";

export function createRetentionQueue(connection: ConnectionOptions): Queue {
  return new Queue(RETENTION_QUEUE_NAME, { connection });
}

export function startRetentionWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker(
    RETENTION_QUEUE_NAME,
    async (job) => {
      console.log(`[retention] Running retention job ${job.id}`);
      const db = getDb();
      const now = new Date();

      // --- Delete expired packets first (FK dependency) ---
      const expiredPackets = await db
        .select({ id: packets.id, sessionId: packets.sessionId })
        .from(packets)
        .where(lte(packets.deleteAt, now));

      for (const pkt of expiredPackets) {
        await db.delete(packets).where(sql`${packets.id} = ${pkt.id}`);
        await db.insert(auditEvents).values({
          id: uuidv4(),
          sessionId: pkt.sessionId,
          eventType: "delete",
          actor: "system:retention-job",
          metadata: { packetId: pkt.id, reason: "retention_policy" },
        });
        console.log(`[retention] Deleted packet ${pkt.id}`);
      }

      // --- Delete expired sessions ---
      const expiredSessions = await db
        .select({ id: intakeSessions.id })
        .from(intakeSessions)
        .where(lte(intakeSessions.deleteAt, now));

      for (const s of expiredSessions) {
        // Audit before deletion (cascade will delete audit_events too, so log elsewhere if needed)
        await db.insert(auditEvents).values({
          id: uuidv4(),
          sessionId: s.id,
          eventType: "delete",
          actor: "system:retention-job",
          metadata: { reason: "retention_policy" },
        });
        await db.delete(intakeSessions).where(sql`${intakeSessions.id} = ${s.id}`);
        console.log(`[retention] Deleted session ${s.id}`);
      }

      return { deletedPackets: expiredPackets.length, deletedSessions: expiredSessions.length };
    },
    { connection }
  );

  worker.on("failed", (job, err) => {
    console.error(`[retention] Job ${job?.id} failed:`, err);
  });

  return worker;
}
