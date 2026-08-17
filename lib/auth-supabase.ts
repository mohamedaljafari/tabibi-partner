import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  TabibiUser,
  createTabibiSession,
  deleteSessionToken,
  findUserByPhone,
  newSessionToken,
  verifySessionToken,
} from "@/lib/supabase";
import { hashPasswordStrong, verifyProviderPassword } from "@/lib/provider-auth";

/**
 * طبقة المصادقة المشتركة فوق Supabase لتطبيق الشريك (مشروع Afiyati).
 * تحفظ حساب الشريك في جدول tabibi_users المشترك بحالة pending حتى تفعّله
 * الإدارة، ثم ينشئ رمز جلسة مشتركًا مع تطبيق المريض ولوحة التحكم.
 */
const SESSION_TOKEN_LOCAL_KEY = "tabibi-partner.supabase-token.v1";

export async function storeSupabaseToken(token: string | null): Promise<void> {
  if (Platform.OS === "web") {
    if (token === null) {
      window.localStorage.removeItem(SESSION_TOKEN_LOCAL_KEY);
    } else {
      window.localStorage.setItem(SESSION_TOKEN_LOCAL_KEY, token);
    }
    return;
  }
  if (token === null) {
    await AsyncStorage.removeItem(SESSION_TOKEN_LOCAL_KEY);
    return;
  }
  await AsyncStorage.setItem(SESSION_TOKEN_LOCAL_KEY, token);
}

export async function readSupabaseToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return window.localStorage.getItem(SESSION_TOKEN_LOCAL_KEY);
  }
  return await AsyncStorage.getItem(SESSION_TOKEN_LOCAL_KEY);
}

export type AuthState = { user: TabibiUser; token: string } | null;

export async function getAuthState(): Promise<AuthState> {
  const token = await readSupabaseToken();
  if (!token) return null;
  const user = await verifySessionToken(token);
  if (!user || user.role !== "provider") {
    await storeSupabaseToken(null);
    return null;
  }
  return { user, token };
}

export async function signOutProviderSupabase(): Promise<void> {
  const token = await readSupabaseToken();
  if (token) {
    try {
      await deleteSessionToken(token);
    } catch {
      // تجاهل أخطاء الحذف عند تسجيل الخروج.
    }
  }
  await storeSupabaseToken(null);
}

/** تسجيل الدخول: رقم الهاتف + كلمة المرور، مع دعم ترقية الهاش القديم. */
export async function signInProviderWithPhone(
  phone: string,
  password: string,
): Promise<{ user: TabibiUser; token: string } | { error: string }> {
  try {
    const user = await findUserByPhone(phone);
    if (!user) return { error: "لا يوجد حساب بهذا الرقم، أنشئ حسابًا أولًا" };
    if (user.role !== "provider") {
      return { error: "هذا الحساب ليس حساب مقدم خدمة. افتح تطبيق طبيبي للمرضى." };
    }
    if (user.status === "pending") {
      return { error: "حسابك قيد مراجعة الإدارة، سيتم تفعيله قريبًا." };
    }
    if (user.status !== "active") {
      return { error: "الحساب غير نشط حاليًا. تواصل مع الإدارة." };
    }
    const ok = await verifyProviderPassword(user.password_hash as unknown, password);
    if (!ok) return { error: "كلمة المرور غير صحيحة" };
    const token = newSessionToken();
    await createTabibiSession({ id: user.id, role: user.role }, token);
    await storeSupabaseToken(token);
    return { user, token };
  } catch (error) {
    console.error("[supabase-auth] signIn failed:", error);
    return { error: "تعذر الاتصال بخدمة المصادقة؛ تحقق من اتصالك بالإنترنت." };
  }
}

/** إنشاء حساب شريك جديد مشترك: يبقى بحالة pending بانتظار موافقة الإدارة. */
export async function registerProviderWithPhone(input: {
  fullName: string;
  phone: string;
  password: string;
  metadata?: Record<string, unknown>;
}): Promise<{ user: TabibiUser; token: string } | { error: string }> {
  try {
    const existing = await findUserByPhone(input.phone);
    if (existing) return { error: "يوجد حساب مسجل بهذا الرقم مسبقًا" };
    const password_hash = await hashPasswordStrong(input.password);
    const { createTabibiUser } = await import("@/lib/supabase");
    const user = await createTabibiUser({
      phone: input.phone,
      role: "provider",
      display_name: input.fullName.trim(),
      password_hash,
      status: "pending",
      metadata: input.metadata ?? {},
    });
    const token = newSessionToken();
    await createTabibiSession({ id: user.id, role: user.role }, token);
    await storeSupabaseToken(token);
    return { user, token };
  } catch (error) {
    console.error("[supabase-auth] register failed:", error);
    return { error: "تعذر إنشاء الحساب؛ تحقق من اتصالك بالإنترنت." };
  }
}
