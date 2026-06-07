import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getConfig } from "../config";
import * as schema from "./schema";

let _client: ReturnType<typeof drizzle> | null = null;
let _pgClient: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (_client) return _client;
  const config = getConfig();
  _pgClient = postgres(config.databaseUrl);
  _client = drizzle(_pgClient, { schema });
  return _client;
}

export async function closePgClient() {
  if (_pgClient) {
    await _pgClient.end();
    _pgClient = null;
    _client = null;
  }
}
