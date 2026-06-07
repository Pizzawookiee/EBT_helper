/**
 * BullMQ reminders job.
 *
 * Finds navigator tasks that have been pending for more than 24 hours
 * and sends reminder notifications.
 *
 * In production, reminders could be sent via email, SMS, or an internal
 * notification system. This stub logs to console and could be wired to
 * a notification provider.
 */

import { Worker, Queue } from "bullmq";
import { sql, lte, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { navigatorTasks, intakeSessions } from "../db/schema";
import type { ConnectionOptions } from "bullmq";

export const REMINDERS_QUEUE_NAME = "reminders";

export function createRemindersQueue(connection: ConnectionOptions): Queue {
  return new Queue(REMINDERS_QUEUE_NAME, { connection });
}

export function startRemindersWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker(
    REMINDERS_QUEUE_NAME,
    async (job) => {
      console.log(`[reminders] Running reminders job ${job.id}`);
      const db = getDb();

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Find pending tasks older than 24h
      const staleTasks = await db
        .select({
          task: navigatorTasks,
          session: intakeSessions,
        })
        .from(navigatorTasks)
        .innerJoin(intakeSessions, eq(navigatorTasks.sessionId, intakeSessions.id))
        .where(
          sql`${navigatorTasks.status} = 'pending'
            AND ${navigatorTasks.createdAt} <= ${twentyFourHoursAgo}`
        );

      for (const { task, session } of staleTasks) {
        await sendReminder(task.id, task.assignedTo, session.language);
      }

      console.log(`[reminders] Sent ${staleTasks.length} reminder(s)`);
      return { reminders: staleTasks.length };
    },
    { connection }
  );

  worker.on("failed", (job, err) => {
    console.error(`[reminders] Job ${job?.id} failed:`, err);
  });

  return worker;
}

/**
 * Send a reminder for a stale navigator task.
 * Replace this stub with email/SMS/webhook notification logic.
 */
async function sendReminder(
  taskId: string,
  assignedTo: string | null,
  language: string
): Promise<void> {
  const recipient = assignedTo ?? "unassigned navigator";
  console.log(
    `[reminders] REMINDER: Task ${taskId} for ${recipient} has been pending >24h. ` +
    `Session language: ${language}. Please review the navigator queue.`
  );
  // TODO: Integrate with email/SMS provider
  // e.g. await sendEmail(assignedTo, "Pending SNAP case reminder", ...)
}
