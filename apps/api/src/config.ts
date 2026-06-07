/**
 * Configuration — parse and validate environment variables.
 * Call getConfig() once at startup; fail fast if required vars are missing.
 */

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export interface Config {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  twilio: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  };
  openaiApiKey: string;
  communityOrgName: string;
  retention: {
    audioRetentionDays: number;
    transcriptRetentionDays: number;
    packetRetentionDays: number;
  };
}

let _config: Config | null = null;

export function getConfig(): Config {
  if (_config) return _config;

  _config = {
    port: parseInt(optionalEnv("PORT", "3001"), 10),
    databaseUrl: requireEnv("DATABASE_URL"),
    redisUrl: requireEnv("REDIS_URL"),
    twilio: {
      accountSid: requireEnv("TWILIO_ACCOUNT_SID"),
      authToken: requireEnv("TWILIO_AUTH_TOKEN"),
      phoneNumber: requireEnv("TWILIO_PHONE_NUMBER"),
    },
    openaiApiKey: requireEnv("OPENAI_API_KEY"),
    communityOrgName: requireEnv("COMMUNITY_ORG_NAME"),
    retention: {
      audioRetentionDays: parseInt(
        optionalEnv("AUDIO_RETENTION_DAYS", "30"),
        10
      ),
      transcriptRetentionDays: parseInt(
        optionalEnv("TRANSCRIPT_RETENTION_DAYS", "30"),
        10
      ),
      packetRetentionDays: parseInt(
        optionalEnv("PACKET_RETENTION_DAYS", "90"),
        10
      ),
    },
  };

  return _config;
}
