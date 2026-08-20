import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Local user identifier (openId), e.g. "local:<email>". Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  passwordHash: text("password_hash"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ---------------------------------------------------------------------------
// الجداول المشتركة بين تطبيق المريض وتطبيق الشريك ولوحة التحكم.
// تحل محل جداول Supabase (tabibi_users / tabibi_sessions / tabibi_records)
// بعد إيقاف مشروع Supabase الخارجي.
// ---------------------------------------------------------------------------

/** حسابات المستخدمين المشتركة (مرضى + مقدمي خدمة + إدارة). */
export const tabibiUsers = mysqlTable("tabibi_users", {
  id: varchar("id", { length: 48 }).primaryKey(),
  phone: varchar("phone", { length: 32 }).notNull().unique(),
  role: mysqlEnum("role", ["patient", "provider", "admin"]).notNull(),
  displayName: varchar("display_name", { length: 160 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  status: mysqlEnum("status", ["active", "pending", "rejected", "suspended"])
    .default("active")
    .notNull(),
  /** محاولات فاشلة متتالية لقفل الحساب المؤقت عند تجاوز الحد. */
  failedAttempts: int("failed_attempts").default(0).notNull(),
  lockedUntil: timestamp("locked_until"),
  metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type TabibiUserRow = typeof tabibiUsers.$inferSelect;
export type InsertTabibiUser = typeof tabibiUsers.$inferInsert;

/** جلسات المستخدمين المشتركة (رمز مجزأ بدل النص الصريح). */
export const tabibiSessions = mysqlTable("tabibi_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("user_id", { length: 48 }).notNull(),
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TabibiSessionRow = typeof tabibiSessions.$inferSelect;
export type InsertTabibiSession = typeof tabibiSessions.$inferInsert;

/** سجلات عامة مرنة (عناوين، ملفات طبية، إعدادات...) لكل مالك. */
export const tabibiRecords = mysqlTable("tabibi_records", {
  id: int("id").autoincrement().primaryKey(),
  collection: varchar("collection", { length: 64 }).notNull(),
  ownerKey: varchar("owner_key", { length: 128 }).notNull().unique(),
  payload: json("payload").$type<unknown>().notNull(),
  createdBy: varchar("created_by", { length: 48 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type TabibiRecordRow = typeof tabibiRecords.$inferSelect;
export type InsertTabibiRecord = typeof tabibiRecords.$inferInsert;
