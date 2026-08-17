import { createClient } from "@supabase/supabase-js";

/**
 * طبقة الاتصال الموحد بـ Supabase لمشروع Afiyati.
 * يُبنى عميل `anon` علنيًا آمنًا من خلال سياسات RLS؛ لا يُستخدم service key
 * أبدًا داخل واجهات العميل المنشورة.
 */
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://fcjfkvlptuxylejmjbkh.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_Nx_xaH5iqB-udxMlzXcEmw_DDrWq0wx";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

export type TabibiRole = "patient" | "provider" | "admin";
export type TabibiUserStatus = "active" | "pending" | "rejected" | "suspended";

export interface TabibiUser {
  id: string;
  phone: string;
  role: TabibiRole;
  display_name: string;
  password_hash: string;
  status?: TabibiUserStatus;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TabibiSession {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
}

/** توليد رمز جلسة بسيط ومجزأ عبر SHA-256 دون الاعتماد على crypto.subtle في metro القديم. */
function hashToken(token: string): string {
  let h1 = 0x6a09e667,
    h2 = 0xbb67ae85,
    h3 = 0x3c6ef372,
    h4 = 0xa54ff53a;
  for (let i = 0; i < token.length; i++) {
    const c = token.charCodeAt(i);
    h1 = (h1 + c) ^ ((h2 << 13) | (h2 >>> 19));
    h2 = (h2 + c) ^ ((h3 << 17) | (h3 >>> 15));
    h3 = (h3 + c) ^ ((h4 << 11) | (h4 >>> 21));
    h4 = (h4 + c) ^ ((h1 << 7) | (h1 >>> 25));
  }
  return [h1, h2, h3, h4].map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

export function newSessionToken(): string {
  const bytes = new Uint8Array(32);
  // في بيئة الويب قد لا يكون crypto.getRandomValues متاحًا دائمًا؛ نوفر بديلًا
  const rnd =
    typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues
      ? globalThis.crypto.getRandomValues(bytes)
      : (() => {
          for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
          return bytes;
        })();
  return (
    Array.from(rnd)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("") +
    Date.now().toString(36)
  );
}

/** تسجيل دخول عبر token الجلسة المخزن في supabase.sessions بدل المصادقة الافتراضية. */
export async function createTabibiSession(
  user: Pick<TabibiUser, "id" | "role">,
  token: string,
): Promise<TabibiSession> {
  const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("tabibi_sessions")
    .insert({
      user_id: user.id,
      token_hash: hashToken(token),
      expires_at,
    })
    .select("id, user_id, expires_at, token_hash")
    .single();
  if (error || !data) throw error ?? new Error("failed to create session");
  return data as TabibiSession;
}

/** إنشاء حساب جديد في supabase.tabibi_users. */
export async function createTabibiUser(input: {
  phone: string;
  role: TabibiRole;
  display_name: string;
  password_hash: string;
  status?: TabibiUserStatus;
  metadata?: Record<string, unknown>;
}): Promise<TabibiUser> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("tabibi_users")
    .insert({
      phone: input.phone,
      role: input.role,
      display_name: input.display_name,
      password_hash: input.password_hash,
      status: input.status ?? (input.role === "provider" ? "pending" : "active"),
      metadata: input.metadata ?? {},
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("failed to create user");
  return data as TabibiUser;
}

/** بحث مستخدم حسب الهاتف. */
export async function findUserByPhone(phone: string): Promise<TabibiUser | null> {
  const { data, error } = await supabase
    .from("tabibi_users")
    .select("*")
    .eq("phone", phone)
    .limit(1);
  if (error) throw error;
  return (data as TabibiUser[])[0] ?? null;
}

/** التحقق من صلاحية جلسة حالية عبر hash الرمز. */
export async function verifySessionToken(token: string): Promise<TabibiUser | null> {
  const { data, error } = await supabase
    .from("tabibi_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const session = data[0] as TabibiSession;
  const { data: user, error: userError } = await supabase
    .from("tabibi_users")
    .select("*")
    .eq("id", session.user_id)
    .single();
  if (userError || !user) return null;
  return user as TabibiUser;
}

/** حذف كل الجلسات عند تسجيل الخروج. */
export async function deleteSessionToken(token: string): Promise<void> {
  await supabase.from("tabibi_sessions").delete().eq("token_hash", hashToken(token));
}

/** جلب مستخدم بمعرفه المباشر. */
export async function getUserById(id: string): Promise<TabibiUser | null> {
  const { data, error } = await supabase
    .from("tabibi_users")
    .select("*")
    .eq("id", id)
    .limit(1);
  if (error) throw error;
  return (data as TabibiUser[])[0] ?? null;
}

/** تحديث الحقول الوظيفية لمقدم الخدمة داخل metadata. */
export async function updateUserMetadata(
  userId: string,
  metadata: Record<string, unknown>,
): Promise<TabibiUser> {
  const existing = await getUserById(userId);
  if (!existing) throw new Error("user not found");
  const merged = { ...existing.metadata, ...metadata };
  const { data, error } = await supabase
    .from("tabibi_users")
    .update({ metadata: merged, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("failed to update user");
  return data as TabibiUser;
}

/** تغيير حالة الحساب (تفعيل مقدم الخدمة من الإدارة). */
export async function updateUserStatus(
  userId: string,
  status: TabibiUserStatus,
): Promise<TabibiUser> {
  const { data, error } = await supabase
    .from("tabibi_users")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("failed to update status");
  return data as TabibiUser;
}
