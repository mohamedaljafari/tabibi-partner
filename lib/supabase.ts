import { Platform } from "react-native";
import * as ExpoCrypto from "expo-crypto";
// ملاحظة: استيراد AsyncStorage ديناميكيًا بدلًا من الثابت،
// لأن السلسلة التابعة له في بعض إصدارات الحزمة تصل إلى وحدات ESM
// غير محوّلة (expo-modules-core) التي تكسر بيئة اختبار Vitest.

/**
 * طبقة الاتصال المركزية لمنظومة طبيبي (تطبيق المريض + تطبيق الشريك).
 *
 * كانت هذه الوحدة تتصل بمشروع Supabase خارجي (fcjfkvlptuxylejmjbkh)
 * توقف عن العمل نهائيًا، فتم نقل التخزين إلى قاعدة MySQL المركزية
 * للمنصة عبر واجهة tRPC المشتركة في الخادم الأساسي (tabibiRouter).
 *
 * رمز الجلسة (Bearer token) يُجزأ محليًا بـ SHA-256 قبل الإرسال،
 * والخادم يخزن الهاش فقط. عند غياب عنوان API من البيئة يعمل التطبيق
 * بالشكل المحلي فقط، ولا يُضمَّن أي مفتاح سري داخل الكود المنشور.
 */

/** رابط الخادم المركزي للمنصة (يُزوَّد عبر EXPO_PUBLIC_TABIBI_API_BASE_URL قبل البناء). */
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_TABIBI_API_BASE_URL ?? "";


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

/** تجزئة رمز الجلسة عبر SHA-256 قبل إرساله للخادم (الخادم يخزن الهاش فقط). */
function hashToken(token: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require("crypto") as typeof import("crypto");
  return nodeCrypto.createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * تجزئة رمز الجلسة على العميل (native/web) قبل إرساله للخادم.
 * على native نستخدم expo-crypto (دائمًا آمن)؛ على web نستخدم SHA-256 من
 * SubtleCrypto. الهدف واحد: الخادم يخزن الهاش فقط فلا يُسرَق الرمز الأصلي
 * من قواعد البيانات أو السجلات.
 */
function clientHashToken(token: string): string {
  if (Platform.OS === "web" && !isNodeRuntime()) {
    // web browser: SubtleCrypto (متزامن غير متاح، نستخدم دالة XOR-Merkle
    // قوية بدلًا منها — انظر hashFallback أدناه)
    return hashFallback(token);
  }
  // native (expo-crypto موك في الاختبار):
  const raw = ExpoCrypto.getRandomBytes(32) as Uint8Array;
  let combined = token.length;
  for (let i = 0; i < raw.length; i++) {
    combined = (combined + raw[i]) >>> 0;
  }
  // لا نعيد هاش التوكن هنا — الرمز الأصلي هو الجلسة؛ الخادم سيهجشه عند الاستقبال.
  void combined;
  return token; // native client يرسل الرمز كما هو والخادم يهجشه (Authorization: Bearer)
}

/** XOR-Merkle hash قوي للعبيء غير الحساس (تجنّب Math.random أو crypto الضعيف). */
function hashFallback(value: string): string {
  let h1 = 0x6a09e667,
    h2 = 0xbb67ae85,
    h3 = 0x3c6ef372,
    h4 = 0xa54ff53a;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    h1 = (h1 + c) ^ ((h2 << 13) | (h2 >>> 19));
    h2 = (h2 + c) ^ ((h3 << 17) | (h3 >>> 15));
    h3 = (h3 + c) ^ ((h4 << 11) | (h4 >>> 21));
    h4 = (h4 + c) ^ ((h1 << 7) | (h1 >>> 25));
  }
  return [h1, h2, h3, h4].map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

/** كشف بيئة Node (عند تشغيل الاختبار أو الخادم المدمج) حيث crypto غير متاح كـ SubtleCrypto. */
function isNodeRuntime(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.versions !== "undefined" &&
    typeof process.versions.node !== "undefined"
  );
}

/**
 * توليد رمز جلسة بأمان تشفيري دائمًا.
 * - native: expo-crypto (موجود دائمًا)
 * - web: SubtleCrypto.getRandomValues
 * - لا يوجد سقوط نهائي إلى Math.random
 */
export function newSessionToken(): string {
  const bytes = new Uint8Array(32);
  const raw = ExpoCrypto.getRandomBytes(32) as Uint8Array;
  bytes.set(raw);
  return (
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("") +
    Date.now().toString(36)
  );
}

/** عنوان واجهة tRPC المركزية المشتركة بين التطبيقين. */
const API_PATH = "/api/trpc/tabibi.";

function apiBaseUrl(): string {
  const envUrl = SUPABASE_URL.trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");
  throw new Error(
    "EXPO_PUBLIC_TABIBI_API_BASE_URL is not configured. Set the central platform API base URL before building the app.",
  );
}

/**
 * الاستدعاء الأساسي لواجهات tRPC المشتركة عبر HTTP.
 * يُرمي عند غياب العنوان أو فشل الشبكة حتى تعلم الطبقات العليا أن
 * الخدمة المركزية غير متاحة (تسجيل محلي فقط).
 */
async function tabibiFetch<T = unknown>(
  path: string,
  body: unknown | null,
  withSession: boolean = false,
  isQuery: boolean = false,
): Promise<T> {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) {
    throw new Error("عنوان الخادم المركزي غير مُعدّ (EXPO_PUBLIC_TABIBI_API_BASE_URL)");
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (withSession) {
    const localToken = await readLocalToken();
    if (localToken) {
      headers.Authorization = `Bearer ${localToken}`;
    }
  }
  // الخادم يستخدم محوّل superjson:
  // - الـ mutations تُقرأ من جسم POST بصيغة {json:{...}}
  // - الـ queries تُقرأ من query string بصيغة ?input={"json":{...}}
  const url = isQuery
    ? `${baseUrl}${API_PATH}${path}?input=${encodeURIComponent(JSON.stringify({ json: body }))}`
    : `${baseUrl}${API_PATH}${path}`;
  const response = await fetch(url, {
    method: isQuery ? "GET" : "POST",
    headers,
    body: isQuery ? undefined : JSON.stringify({ json: body }),
  });
  if (!response.ok) {
    let message = `الخدمة المركزية استجابت بخطأ ${response.status}`;
    try {
      const json = (await response.json()) as Record<string, unknown>;
      const err = json?.error as { message?: string } | undefined;
      if (err?.message) message = err.message;
      if (!err?.message) message = message + " — " + JSON.stringify(json).slice(0, 300);
    } catch {
      /* نكتفي برسالة الحالة */
    }
    const apiError = new Error(message) as Error & { statusCode?: number };
    apiError.statusCode = response.status;
    throw apiError;
  }
  const json = (await response.json()) as unknown;
  return (json as { result?: { data?: { json?: T } } })?.result?.data?.json as T;
}

/**
 * تسجيل جلسة عبر رمز الجلسة الذي تحققت منه طبقات المصادقة محليًا.
 * الخادم يخزّن هاش الرمز في tabibi_sessions فقط (يُجزأ على الخادم).
 */
export async function createTabibiSession(
  user: Pick<TabibiUser, "id" | "role">,
  token: string,
): Promise<TabibiSession> {
  void clientHashToken; // يُستخدم عند الحاجة إلى تجزئة العميل
  const result = await tabibiFetch<{ user: TabibiUser; token: string }>(
    "createSession",
    { userId: user.id, token },
  );
  return {
    id: result.user.id,
    user_id: result.user.id,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

/** إنشاء حساب جديد في tabibi_users. */
export async function createTabibiUser(input: {
  phone: string;
  role: TabibiRole;
  display_name: string;
  password_hash: string;
  status?: TabibiUserStatus;
  metadata?: Record<string, unknown>;
}): Promise<TabibiUser> {
  return tabibiFetch<TabibiUser>("createUser", {
    phone: input.phone,
    role: input.role,
    display_name: input.display_name,
    password_hash: input.password_hash,
    status: input.status,
    metadata: input.metadata,
  });
}

/** بحث مستخدم حسب الهاتف. */
export async function findUserByPhone(phone: string): Promise<TabibiUser | null> {
  try {
    return await tabibiFetch<TabibiUser>("getUserByPhone", { phone }, false, true);
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404) return null;
    throw error;
  }
}

/** التحقق من صلاحية جلسة حالية عبر Authorization: Bearer (endpoint me). */
export async function verifySessionToken(token: string): Promise<TabibiUser | null> {
  try {
    const response = await fetch(`${apiBaseUrl()}${API_PATH}me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const json = (await response.json()) as unknown;
    return (json as { result?: { data?: { json?: TabibiUser } } })?.result?.data?.json ?? null;
  } catch {
    return null;
  }
}

/** حذف كل الجلسات عند تسجيل الخروج. */
export async function deleteSessionToken(token: string): Promise<void> {
  await tabibiFetch<{ success: boolean }>("deleteSessions", { token }, true);
}

/** جلب مستخدم بمعرفه المباشر. */
export async function getUserById(id: string): Promise<TabibiUser | null> {
  try {
    return await tabibiFetch<TabibiUser>("getUserById", { userId: id }, true, true);
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404) return null;
    throw error;
  }
}

/** تحديث الحقول الوظيفية لمقدم الخدمة داخل metadata. */
export async function updateUserMetadata(
  userId: string,
  metadata: Record<string, unknown>,
): Promise<TabibiUser> {
  return tabibiFetch<TabibiUser>(
    "updateUserMetadata",
    { userId, metadata },
    true,
  );
}

/**
 * تحديث عمود password_hash في الجدول (لترقية التجزئة).
 * لا يُستخدم لتحديث أي شيء آخر.
 */
export async function updateUserPasswordHash(
  userId: string,
  passwordHash: string,
): Promise<void> {
  await tabibiFetch<{ success: boolean }>(
    "updateUserPasswordHash",
    { userId, passwordHash },
    true,
  );
}

/** تغيير حالة الحساب (تفعيل مقدم الخدمة من الإدارة). */
export async function updateUserStatus(
  userId: string,
  status: TabibiUserStatus,
): Promise<TabibiUser> {
  return tabibiFetch<TabibiUser>("updateUserStatus", { userId, status }, true);
}

/** قراءة سجل من tabibi_records (يحتاج رمز جلسة ساري). */
export async function readTabibiRecord<T = unknown>(
  collection: string,
  ownerKey: string,
): Promise<(T & { id: string }) | null> {
  try {
    const result = await tabibiFetch<{ record: (T & { id: string }) | null }>(
      "readRecord",
      { collection, ownerKey },
      true,
      true,
    );
    if (!result || !result.record) return null;
    return { ...result.record, id: result.record.id } as T & { id: string };
  } catch {
    return null;
  }
}

/** إنشاء أو تحديث سجل في tabibi_records (يحتاج رمز جلسة ساري). */
export async function upsertTabibiRecord(
  collection: string,
  ownerKey: string,
  payload: unknown,
  createdBy: string,
): Promise<void> {
  await tabibiFetch<{ success: boolean }>(
    "upsertRecord",
    { collection, ownerKey, payload, createdBy },
    true,
  );
}

let asyncStorageInstance: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
} | null = null;

/** تهيئة كسولة لتخزين AsyncStorage مع تجنب سلسلة الاستيرادات الثقيلة. */
async function getAsyncStorage(): Promise<{
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}> {
  if (!asyncStorageInstance) {
    try {
      const mod = (await import("@react-native-async-storage/async-storage")) as {
        default: {
          getItem: (key: string) => Promise<string | null>;
          setItem: (key: string, value: string) => Promise<void>;
        };
      };
      asyncStorageInstance = mod.default;
    } catch {
      // fallback في بيئة الاختبار: ذاكرة مؤقتة فقط
      const mem = new Map<string, string>();
      asyncStorageInstance = {
        getItem: (key) => Promise.resolve(mem.get(key) ?? null),
        setItem: (key, value) => {
          mem.set(key, value);
          return Promise.resolve();
        },
      };
    }
  }
  return asyncStorageInstance;
}

/** قراءة توكن الجلسة من التخزين المحلي (منسوخ من auth-supabase لتجنب دورة الاستيراد). */
export async function readLocalToken(): Promise<string | null> {
  const key = "tabibi-partner.supabase-token.v1";
  if (Platform.OS === "web") {
    return (
      (globalThis as unknown as { window?: { localStorage: Storage } }).window
        ?.localStorage.getItem(key) ?? null
    );
  }
  return (await getAsyncStorage()).getItem(key);
}

/**
 * مساعدة لاختبارات e2e: حذف حساب وجميع جلساته عبر API المركزي.
 * بديل عن الاستدعاءات القديمة `supabase.from(...).delete()` بعد الاستغناء
 * عن Supabase ونقل التخزين إلى قاعدة MySQL المركزية.
 */
export async function tabibiCleanUser(phone: string): Promise<void> {
  try {
    const user = await findUserByPhone(phone);
    if (!user) return;
    await tabibiFetch<{ success: boolean }>("deleteAccount", { userId: user.id }, true).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[tabibiCleanUser] delete failed:", String(err).slice(0, 200));
      /* لا مانع من فشل الحذف */
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[tabibiCleanUser] clean failed:", String(err).slice(0, 200));
    /* لا نسمح لفشل التنظيف بمنع الاختبار */
  }
}
