import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { ONE_YEAR_MS } from "../../shared/const";
import * as db from "../db";
import { ENV } from "./env";

const PBKDF2_ALGORITHM = "sha256";
const PBKDF2_ITERATIONS = 600_000;
const KEY_LENGTH = 32;

function getSecretKey(): Uint8Array {
  const secret = ENV.jwtSecret;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET is not configured or too short. Set a random 32+ character secret in JWT_SECRET.",
    );
  }
  return new TextEncoder().encode(secret);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_ALGORITHM);
  return `pbkdf2:${PBKDF2_ALGORITHM}:${PBKDF2_ITERATIONS}:${salt}:${key.toString("hex")}`;
}

export function comparePassword(password: string, stored: string): boolean {
  const [scheme, algorithm, iterationsStr, salt, expectedHex] = stored.split(":");
  if (scheme !== "pbkdf2" || !iterationsStr || !salt || !expectedHex) return false;
  const iterations = Number(iterationsStr);
  if (!Number.isFinite(iterations)) return false;
  let key: Buffer;
  try {
    key = pbkdf2Sync(password, salt, iterations, KEY_LENGTH, algorithm as string);
  } catch {
    return false;
  }
  const expected = Buffer.from(expectedHex, "hex");
  if (key.length !== expected.length) return false;
  return timingSafeEqual(key, expected);
}

/** Local stable user identifier built from the normalized email address. */
export function createOpenId(email: string): string {
  return `local:${email}`;
}

export async function registerUser(opts: {
  name: string;
  email: string;
  password: string;
}): Promise<User> {
  const normalizedEmail = opts.email.trim().toLowerCase();

  const existing = await db.getUserByEmail(normalizedEmail);
  if (existing) {
    const err = new Error("ACCOUNT_EXISTS") as Error & { code: string };
    err.code = "CONFLICT";
    throw err;
  }

  const passwordHash = hashPassword(opts.password);
  const openId = createOpenId(normalizedEmail);
  const isAdmin =
    typeof ENV.ownerEmail === "string" &&
    ENV.ownerEmail.length > 0 &&
    normalizedEmail === ENV.ownerEmail.toLowerCase();

  await db.upsertUser({
    openId,
    name: opts.name.trim(),
    email: normalizedEmail,
    loginMethod: "local",
    passwordHash,
    role: isAdmin ? "admin" : "user",
    lastSignedIn: new Date(),
  });

  const user = await db.getUserByOpenId(openId);
  if (!user) throw new Error("فشل في إنشاء المستخدم");
  return user;
}

export async function loginUser(opts: { email: string; password: string }): Promise<User> {
  const normalizedEmail = opts.email.trim().toLowerCase();

  const user = await db.getUserByEmail(normalizedEmail);
  if (!user || !user.passwordHash || !comparePassword(opts.password, user.passwordHash)) {
    // Run the hash anyway on a fixed-cost path to keep timing roughly constant.
    hashPassword(opts.password);
    throw new Error("INVALID_CREDENTIALS");
  }

  await db.markUserSignedIn(user.openId, new Date());
  return user;
}

export function createSessionToken(
  openId: string,
  options: { expiresInMs?: number; name?: string } = {},
): Promise<string> {
  return new SignJWT({
    openId,
    appId: "local",
    name: options.name ?? "",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(
      Math.floor((Date.now() + (options.expiresInMs ?? ONE_YEAR_MS)) / 1000),
    )
    .sign(getSecretKey());
}

/**
 * In-memory revocation cache for JWT session tokens.
 * A logout revokes the exact token so a stolen cookie cannot stay usable after logout.
 * Entries expire on their own once the JWT's own expiry time is reached.
 */
const revokedTokens = new Map<string, number>();

export function revokeSessionToken(token: string): void {
  const parts = token.split(".");
  if (parts.length !== 3) return;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const exp = typeof payload?.exp === "number" ? payload.exp * 1000 : Date.now() + 3600_000;
    revokedTokens.set(token, exp);
  } catch {
    revokedTokens.set(token, Date.now() + 3600_000);
  }
}

function pruneRevokedTokens(): void {
  const now = Date.now();
  for (const [token, exp] of revokedTokens) {
    if (exp < now) revokedTokens.delete(token);
  }
}

export async function verifySessionToken(
  token: string,
): Promise<{ openId: string; name: string } | null> {
  try {
    if (revokedTokens.has(token)) return null;
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    const { openId, name } = payload as Record<string, unknown>;
    if (typeof openId !== "string" || typeof name !== "string") return null;
    // Lazily prune stale revocation entries (bounded map growth).
    if (revokedTokens.size > 1000) pruneRevokedTokens();
    return { openId, name };
  } catch {
    return null;
  }
}
