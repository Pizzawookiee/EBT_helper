/**
 * EBT Helper API — Express application entry point.
 *
 * Mounts all routes, connects to Postgres and Redis, starts BullMQ workers.
 */

import express from "express";
import { getConfig } from "./config";
import { getDb, closePgClient } from "./db/client";
import { voiceRouter } from "./routes/voice";
import { sessionsRouter } from "./routes/sessions";
import { navigatorRouter } from "./routes/navigator";
import { createRetentionQueue, startRetentionWorker } from "./jobs/retention";
import { createRemindersQueue, startRemindersWorker } from "./jobs/reminders";
import Redis from "ioredis";

async function main() {
  const config = getConfig();

  // ---------------------------------------------------------------------------
  // Express setup
  // ---------------------------------------------------------------------------
  const app = express();

  // Parse Twilio URL-encoded webhook bodies and JSON REST bodies
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  // Trust Twilio proxy headers
  app.set("trust proxy", 1);

  // ---------------------------------------------------------------------------
  // Routes
  // ---------------------------------------------------------------------------
  app.use("/voice", voiceRouter);
  app.use("/sessions", sessionsRouter);
  app.use("/navigator", navigatorRouter);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "ebt-api" });
  });

  // ---------------------------------------------------------------------------
  // Database connection (lazy — getDb() connects on first call)
  // ---------------------------------------------------------------------------
  try {
    const db = getDb();
    // Lightweight connection probe
    await (db as any).execute("SELECT 1");
    console.log("[api] Postgres connected");
  } catch (err) {
    console.error("[api] Postgres connection failed:", err);
    // Don't crash — let individual requests fail gracefully
  }

  // ---------------------------------------------------------------------------
  // Redis + BullMQ
  // ---------------------------------------------------------------------------
  const redisConnection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

  redisConnection.on("connect", () => console.log("[api] Redis connected"));
  redisConnection.on("error", (err) => console.error("[api] Redis error:", err));

  const bullConnection = { host: new URL(config.redisUrl).hostname, port: 6379 };

  // Start workers
  startRetentionWorker(bullConnection);
  startRemindersWorker(bullConnection);

  // Schedule recurring jobs
  const retentionQueue = createRetentionQueue(bullConnection);
  const remindersQueue = createRemindersQueue(bullConnection);

  // Retention: daily at midnight
  await retentionQueue.add(
    "daily-retention",
    {},
    { repeat: { pattern: "0 0 * * *" }, removeOnComplete: 5, removeOnFail: 5 }
  );

  // Reminders: every hour
  await remindersQueue.add(
    "hourly-reminders",
    {},
    { repeat: { pattern: "0 * * * *" }, removeOnComplete: 5, removeOnFail: 5 }
  );

  console.log("[api] BullMQ workers started");

  // ---------------------------------------------------------------------------
  // Start HTTP server
  // ---------------------------------------------------------------------------
  const server = app.listen(config.port, () => {
    console.log(`[api] Server listening on port ${config.port}`);
  });

  // ---------------------------------------------------------------------------
  // Graceful shutdown
  // ---------------------------------------------------------------------------
  const shutdown = async () => {
    console.log("[api] Shutting down...");
    server.close();
    await closePgClient();
    redisConnection.disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[api] Fatal startup error:", err);
  process.exit(1);
});
