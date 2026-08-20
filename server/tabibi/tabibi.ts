import { createHash, randomBytes } from "crypto";
import { eq, and, gt, desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import { tabibiUsers, tabibiSessions, tabibiRecords, type TabibiUserRow } from "../../drizzle/schema";

// ---------------------------------------------------------------------------
// طبقة البيانات المشتركة لتطبيق المريض وتطبيق الشريك ولوحة التحكم.
// تحل محل الاتصال المباشر بـ Supabase (توقف المشروع الخارجي).
// ملاحظات أمان:
// - رموز الجلسات تُجزَّأ عبر SHA-256 قبل التخزين (لا يُخزَّن الرمز صريحًا).
// - قفل حساب مؤقت بعد تجاوز عدد محاولات فاشلة (Brute-force protection).
// ---------------------------------------------------------------------------

export type TabibiRole = "patient" | "provider" | "admin";
export type TabibiUserStatus = "active" | "pending" | "rejected" | "suspended";

export interface TabibiUserDto {
  id: string;
  phone: string;
  role: TabibiRole;
  display_name: string;
  password_hash: string;
  status: TabibiUserStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  failed_attempts: number;
  locked_until: string | null;
}

/** الحد الأقصى لعدد المحاولات الفاشلة المتتالية قبل القفل المؤقت (15 دقيقة). */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export function newSessionToken(): string {
  return randomBytes(32).toString("hex") + Date.now().toString(36);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function toDto(row: TabibiUserRow): TabibiUserDto {
  return {
    id: row.id,
    phone: row.phone,
    role: row.role as TabibiRole,
    display_name: row.displayName,
    password_hash: row.passwordHash,
    status: row.status as TabibiUserStatus,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    created_at: row.createdAt.toISOString(),
    failed_attempts: row.failedAttempts,
    locked_until: row.lockedUntil ? row.lockedUntil.toISOString() : null,
  };
}

function requireDb() {
  return getDb();
}

export async function findUserByPhone(phone: string): Promise<TabibiUserDto | null> {
  const db = await requireDb();
  if (!db) return null;
  const rows = await db.select().from(tabibiUsers).where(eq(tabibiUsers.phone, phone));
  return rows[0] ? toDto(rows[0]) : null;
}

export async function getUserById(id: string): Promise<TabibiUserDto | null> {
  const db = await requireDb();
  if (!db) return null;
  const rows = await db.select().from(tabibiUsers).where(eq(tabibiUsers.id, id));
  return rows[0] ? toDto(rows[0]) : null;
}

export interface CreateUserInput {
  phone: string;
  role: TabibiRole;
  display_name: string;
  password_hash: string;
  status?: TabibiUserStatus;
  metadata?: Record<string, unknown>;
}

export async function createTabibiUser(input: CreateUserInput): Promise<TabibiUserDto> {
  const db = await requireDb();
  if (!db) throw new Error("database unavailable");
  const now = new Date();
  const id = input.phone + "-" + Date.now().toString(36) + "-" + randomBytes(3).toString("hex");
  await db.insert(tabibiUsers).values({
    id,
    phone: input.phone,
    role: input.role,
    displayName: input.display_name,
    passwordHash: input.password_hash,
    status: input.status ?? (input.role === "provider" ? "pending" : "active"),
    failedAttempts: 0,
    metadata: (input.metadata ?? {}) as never,
    createdAt: now,
    updatedAt: now,
  });
  const _tmpRows = await db.select().from(tabibiUsers).where(eq(tabibiUsers.id, id));
  const row = _tmpRows[0];
  return toDto(row);
}

/** التحقق من رمز الجلسة وإعادة المستخدم صاحبه إن كان صالحًا وغير منتهي. */
export async function verifySessionToken(token: string): Promise<TabibiUserDto | null> {
  const db = await requireDb();
  if (!db) return null;
  const hash = hashToken(token);
  const sessions = await db
    .select()
    .from(tabibiSessions)
    .where(and(eq(tabibiSessions.tokenHash, hash), gt(tabibiSessions.expiresAt, new Date())))
    .orderBy(desc(tabibiSessions.createdAt))
    .limit(1);
  if (sessions.length === 0) return null;
  const userRow = (await db.select().from(tabibiUsers).where(eq(tabibiUsers.id, sessions[0].userId)))[0];
  if (!userRow) return null;
  return toDto(userRow);
}

export async function createTabibiSession(
  user: { id: string; role: TabibiRole },
  token: string,
): Promise<void> {
  const db = await requireDb();
  if (!db) throw new Error("database unavailable");
  await db.insert(tabibiSessions).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  });
}

export async function deleteSessionToken(token: string): Promise<void> {
  const db = await requireDb();
  if (!db) return;
  await db.delete(tabibiSessions).where(eq(tabibiSessions.tokenHash, hashToken(token)));
}

/** حذف كل جلسات مستخدم معين (عند تغيير كلمة المرور أو إيقاف الحساب). */
export async function deleteUser(userId: string): Promise<void> {
  const db = await requireDb();
  if (!db) return;
  await db.delete(tabibiSessions).where(eq(tabibiSessions.userId, userId));
  await db.delete(tabibiRecords).where(eq(tabibiRecords.ownerKey, userId));
  await db.delete(tabibiUsers).where(eq(tabibiUsers.id, userId));
}

export async function deleteUserSessions(userId: string): Promise<void> {
  const db = await requireDb();
  if (!db) return;
  await db.delete(tabibiSessions).where(eq(tabibiSessions.userId, userId));
}

export async function updateUserMetadata(
  userId: string,
  metadata: Record<string, unknown>,
): Promise<TabibiUserDto> {
  const db = await requireDb();
  if (!db) throw new Error("database unavailable");
  const existing = await getUserById(userId);
  if (!existing) throw new Error("user not found");
  const { password_hash: _dropHash, ...cleanMetadata } = metadata;
  const merged = { ...existing.metadata, ...cleanMetadata };
  await db
    .update(tabibiUsers)
    .set({ metadata: merged as never, updatedAt: new Date() })
    .where(eq(tabibiUsers.id, userId));
  return (await getUserById(userId))!;
}

export async function updateUserPasswordHash(userId: string, passwordHash: string): Promise<void> {
  const db = await requireDb();
  if (!db) throw new Error("database unavailable");
  await db.update(tabibiUsers).set({ passwordHash, updatedAt: new Date() }).where(eq(tabibiUsers.id, userId));
  // إبطال كل الجلسات النشطة بعد تغيير كلمة المرور
  await deleteUserSessions(userId);
}

export async function updateUserStatus(
  userId: string,
  status: TabibiUserStatus,
): Promise<TabibiUserDto> {
  const db = await requireDb();
  if (!db) throw new Error("database unavailable");
  await db.update(tabibiUsers).set({ status, updatedAt: new Date() }).where(eq(tabibiUsers.id, userId));
  const updated = (await getUserById(userId))!;
  // إيقاف الحساب يُبطل كل الجلسات النشطة
  if (status !== "active") await deleteUserSessions(userId);
  return updated;
}

/**
 * تسجيل محاولة دخول فاشلة وقفل الحساب مؤقتًا عند تجاوز الحد.
 * يعيد true إذا كان الحساب مقفلاً حاليًا.
 */
export async function recordFailedLogin(phone: string): Promise<boolean> {
  const db = await requireDb();
  if (!db) return false;
  const user = (await db.select().from(tabibiUsers).where(eq(tabibiUsers.phone, phone)))[0];
  if (!user) return false;
  const attempts = user.failedAttempts + 1;
  const now = new Date();
  const update: Record<string, unknown> = { failedAttempts: attempts, updatedAt: now };
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    update.lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000);
  }
  await db.update(tabibiUsers).set(update as never).where(eq(tabibiUsers.id, user.id));
  return attempts >= MAX_FAILED_ATTEMPTS;
}

/** إعادة ضبط عداد الفشل عند تسجيل دخول ناجح. */
export async function resetFailedLogins(userId: string): Promise<void> {
  const db = await requireDb();
  if (!db) return;
  await db
    .update(tabibiUsers)
    .set({ failedAttempts: 0, lockedUntil: sql`NULL`, updatedAt: new Date() })
    .where(eq(tabibiUsers.id, userId));
}

export function isLockedOut(user: TabibiUserRow): boolean {
  return !!user.lockedUntil && new Date(user.lockedUntil) > new Date();
}

// ---------------------------------------------------------------------------
// السجلات العامة (عناوين، ملفات طبية، إعدادات) — تكافئ tabibi_records في Supabase.
// ---------------------------------------------------------------------------

export async function readRecord<T = unknown>(
  collection: string,
  ownerKey: string,
): Promise<(T & { id: number }) | null> {
  const db = await requireDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(tabibiRecords)
    .where(and(eq(tabibiRecords.collection, collection), eq(tabibiRecords.ownerKey, ownerKey)))
    .limit(1);
  if (rows.length === 0) return null;
  return { ...(rows[0].payload as T), id: rows[0].id };
}

export async function upsertRecord(
  collection: string,
  ownerKey: string,
  payload: unknown,
  createdBy: string,
): Promise<void> {
  const db = await requireDb();
  if (!db) throw new Error("database unavailable");
  const existing = await readRecord(collection, ownerKey);
  const now = new Date();
  if (existing) {
    await db
      .update(tabibiRecords)
      .set({ payload: payload as never, updatedAt: now })
      .where(eq(tabibiRecords.id, existing.id));
    return;
  }
  await db.insert(tabibiRecords).values({
    collection,
    ownerKey,
    payload: payload as never,
    createdBy,
    createdAt: now,
    updatedAt: now,
  });
}

/** كل سجلات مجموعة معينة لمالك معين (للسجلات متعددة العناصر). */
export async function readRecords<T = unknown>(
  collection: string,
  ownerKeyPrefix: string,
): Promise<(T & { id: number; owner_key: string })[]> {
  const db = await requireDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(tabibiRecords)
    .where(and(eq(tabibiRecords.collection, collection), sql`${tabibiRecords.ownerKey} LIKE ${ownerKeyPrefix + "%"}`));
  return rows.map((r) => ({ ...(r.payload as T), id: r.id, owner_key: r.ownerKey }));
}
