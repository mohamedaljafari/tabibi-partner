import { config as loadDotenv } from "dotenv";
// Load .env if present, then .env.local (local-only overrides, never committed).
// Done here (rather than in index.ts) so every module importing ENV sees the
// fully-loaded environment regardless of ESM import hoisting order.
loadDotenv();
loadDotenv({ path: ".env.local", override: false });

import { z } from "zod";

const envSchema = z.object({
  jwtSecret: z.string().min(32).default("test-jwt-secret-must-be-at-least-32-chars"),
  databaseUrl: z.string().default(""),
  ownerEmail: z.string().default(""),
  cronSecret: z.string().default(""),
  s3Endpoint: z.string().default(""),
  s3AccessKey: z.string().default(""),
  s3SecretKey: z.string().default(""),
  s3Bucket: z.string().default(""),
  s3Region: z.string().default("us-east-1"),
  s3ForcePathStyle: z.boolean().default(true),
  isProduction: z.boolean().default(process.env.NODE_ENV === "production"),
});

export const ENV = envSchema.parse({
  jwtSecret: process.env.JWT_SECRET,
  databaseUrl: process.env.DATABASE_URL,
  ownerEmail: process.env.OWNER_EMAIL ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3AccessKey: process.env.S3_ACCESS_KEY ?? "",
  s3SecretKey: process.env.S3_SECRET_KEY ?? "",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3Region: process.env.S3_REGION ?? "us-east-1",
  s3ForcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
  isProduction: process.env.NODE_ENV === "production",
});

if (ENV.isProduction && (!ENV.jwtSecret || ENV.jwtSecret.length < 32)) {
  throw new Error("JWT_SECRET is required (32+ characters) in production");
}
if (ENV.isProduction && !ENV.databaseUrl) {
  throw new Error("DATABASE_URL is required in production");
}

/** Local stable owner identifier built from the normalized owner email. */
export const ownerOpenId =
  ENV.ownerEmail && ENV.ownerEmail.length > 0
    ? `local:${ENV.ownerEmail.trim().toLowerCase()}`
    : "";
