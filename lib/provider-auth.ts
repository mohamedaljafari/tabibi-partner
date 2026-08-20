import { isLibyanPhone, normalizeLibyanPhone } from "./libya";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type ProviderAvailability, type ProviderService } from "./provider-services";
import {
  getAuthState,
  registerProviderWithPhone,
  signInProviderWithPhone,
  signOutProviderSupabase,
} from "./auth-supabase";
import { createNotification } from "./notifications";
import { getUserById, updateUserMetadata, updateUserStatus } from "./supabase";

/**
 * خزنة الصفات المتعارف عليها لمقدمي الخدمات الصحية المنزلية.
 * هذه القائمة هي المرجع الوحيد لأسماء الصفات في التطبيق.
 */
export const PROVIDER_ROLES = [
  "طبيب",
  "ممرض",
  "ممرضة",
  "صيدلي",
  "أخصائي مختبر",
  "أخصائي تغذية",
  "أخصائي علاج طبيعي",
  "أخصائي صحة نفسية",
  "أخصائي رعاية كبار السن",
  "طبيب بيطري",
  "أخرى",
] as const;

export type ProviderRole = (typeof PROVIDER_ROLES)[number];

/**
 * خزنة التخصصات الفرعية التي يختار منها مقدم الخدمة تخصصًا واحدًا أو أكثر.
 * الاختيار غير حصري — يمكن اختيار عدة تخصصات معًا.
 */
export const PROVIDER_SPECIALIZATIONS = [
  "طب عام",
  "طب أطفال",
  "طب نساء وولادة",
  "طب باطنة",
  "جراحة عامة",
  "تمريض عام",
  "إسعافات أولية",
  "تمريض رعاية منزلية",
  "رعاية اجتماعية",
  "رعاية نفسية",
  "تحليل نفسي",
  "علاج نفسي",
  "استشارات نفسية",
  "استشارات تغذية",
  "تغذية علاجية",
  "تخسيس وسمنة",
  "علاج طبيعي",
  "تأهيل بدني",
  "رعاية كبار السن",
  "مختبرات وتحاليل",
  "صيدليات ووصفات",
  "تحاليل منزلية",
  "رعاية نفسية مساندة",
  "طب بيطري منزلي",
  "علاج بيطري",
  "أخرى",
] as const;

export type ProviderSpecialization = (typeof PROVIDER_SPECIALIZATIONS)[number];

/**
 * حالة حساب مقدم الخدمة:
 * - pending: بعد التسجيل المباشر، الحساب غير مفعّل ولا يراه المريض.
 * - active: بعد إكمال البيانات والموافقة على المستندات، الحساب مفعّل ويظهر للمريض،
 *   ويُعرض للشريك على أنه "موثّق".
 */
export type AccountStatus = "pending" | "active";

export type ProviderDocument = {
  id: string;
  type: "certificate" | "license" | "other";
  name: string;
  uri: string;
};

export type ProviderAccount = {
  id: string;
  fullName: string;
  role: ProviderRole;
  phone: string;
  /** تجزئة كلمة المرور لأغراض مقارنة محلية فقط: شكل قديم (number) أو قوي SHA-256+salt (string) */
  passwordHash: string | number;
  createdAt: number;
  status: AccountStatus;
  /** تخصصات متعددة يختارها الشريك */
  specializations: string[];
  /** عدد سنوات الخبرة (0 = لم يُحدد بعد) */
  yearsOfExperience: number;
  /** نبذة تعريفية اختيارية تظهر للمريض لاحقًا */
  bio: string;
  /** صورة الشريك الاختيارية التي تظهر للمريض في بطاقة البحث والتفاصيل */
  photoUri?: string;
  /** مستندات الشهادة والترخيص — تبقى محلية ولا يصلها المريض قبل الموافقة */
  documents: ProviderDocument[];
  /** خدمات الشريك المختارة من قوائم التخصصات مع السعر المعروض للمريض */
  services: ProviderService[];
  /** مواعيد التوفر: متاح الآن أو أيام محددة بساعات معينة */
  availability: ProviderAvailability;
};

export type RegistrationInput = {
  fullName: string;
  role: ProviderRole;
  phone: string;
  password: string;
  confirmPassword: string;
};

export type RegistrationValidation = {
  fullName: string;
  role: string;
  phone: string;
  password: string;
  confirmPassword: string;
};

export type ProfileCompletionInput = {
  specializations: string[];
  yearsOfExperience: number;
  bio: string;
  documents: ProviderDocument[];
  /** صورة الشريك الاختيارية (لا تُرفع للمريض إلا بعد توثيق الحساب) */
  photoUri?: string;
  services: ProviderService[];
  availability: ProviderAvailability;
};

export type ProfileCompletionValidation = {
  specializations: string;
};

export const STORAGE_ACCOUNTS_KEY = "provider_accounts_v1";
export const STORAGE_SESSION_KEY = "provider_session_v1";

export const STATUS_LABELS: Record<AccountStatus, string> = {
  pending: "قيد المراجعة",
  active: "موثّق",
};

/** تسميات التخصصات المعروضة في شاشة إكمال البيانات */
export const PROFILE_SPECIALIZATION_LABELS: string[] = [...PROVIDER_SPECIALIZATIONS];

export const PROFILE_VALIDATION = {
  minSpecializations: 1,
};

/** قوائم سنوات الخبرة من 0 إلى 40 سنة */
export const YEARS_OF_EXPERIENCE_OPTIONS: number[] = Array.from({ length: 41 }, (_, index) => index);

export function hashPassword(password: string): number {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = (hash * 33 + password.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * تجزئة تشفيرية قوية (SHA-256) مع مفتاح عشوائي (salt) لكل حساب.
 * التنفيذ الفعلي في وحدة lib/password.ts المستقلة (بلا استيرادات داخلية)
 * لكسر دورة الاستيراد مع auth-supabase.
 * الشكل: "sha256:{salt-hex}:{hex-digest}"
 */
export async function hashPasswordStrong(password: string, salt?: string): Promise<string> {
  const { hashPasswordStrong: impl } = await import("@/lib/password");
  return impl(password, salt);
}

export function isStrongProviderHash(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[0-9a-f]{32}:/.test(value);
}

/** التحقق من كلمة المرور: يقبل الشكل القوي الجديد والشكل القديم للترحيل التدريجي */
export async function verifyProviderPassword(stored: unknown, password: string): Promise<boolean> {
  const { verifyProviderPasswordStrong } = await import("@/lib/password");
  const result = await verifyProviderPasswordStrong(stored, password, hashPassword);
  return result !== null;
}

export function validateRegistration(input: RegistrationInput): RegistrationValidation {
  const errors: RegistrationValidation = {
    fullName: "",
    role: "",
    phone: "",
    password: "",
    confirmPassword: "",
  };

  const name = input.fullName.trim();
  if (!name) {
    errors.fullName = "يرجى إدخال الاسم الكامل";
  } else if (name.length < 3) {
    errors.fullName = "الاسم قصير جدًا، أدخل ثلاثة أحرف على الأقل";
  }

  if (!input.role) {
    errors.role = "يرجى اختيار الصفة من القائمة";
  } else if (!PROVIDER_ROLES.includes(input.role)) {
    errors.role = "الصفة المختارة غير صالحة";
  }

  const normalized = normalizeLibyanPhone(input.phone);
  if (!normalized) {
    errors.phone = "يرجى إدخال رقم الهاتف";
  } else if (!isLibyanPhone(normalized)) {
    errors.phone = "رقم الهاتف غير صالح، أدخل رقمًا ليبيًا بصيغة 09XXXXXXXX (مثال: 0912345678)";
  }

  if (!input.password) {
    errors.password = "يرجى إدخال كلمة المرور";
  } else if (input.password.length < 8) {
    errors.password = "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
  }

  if (!input.confirmPassword) {
    errors.confirmPassword = "يرجى تأكيد كلمة المرور";
  } else if (input.password !== input.confirmPassword) {
    errors.confirmPassword = "كلمتا المرور غير متطابقتين";
  }

  return errors;
}

export function hasRegistrationErrors(errors: RegistrationValidation): boolean {
  return Object.values(errors).some((value) => value.length > 0);
}

export function validateProfileCompletion(input: ProfileCompletionInput): ProfileCompletionValidation {
  if (input.specializations.length === 0) {
    return { specializations: "يرجى اختيار تخصص واحد على الأقل" };
  }
  const invalid = input.specializations.find(
    (spec) => !PROVIDER_SPECIALIZATIONS.includes(spec as ProviderSpecialization),
  );
  if (invalid) {
    return { specializations: "يوجد تخصص غير صالح في القائمة" };
  }
  return { specializations: "" };
}

export function hasProfileErrors(errors: ProfileCompletionValidation): boolean {
  return errors.specializations.length > 0;
}

export async function listProviderAccounts(): Promise<ProviderAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ProviderAccount =>
        typeof item === "object" && item !== null && typeof item.id === "string",
    );
  } catch {
    return [];
  }
}

export async function saveProviderAccounts(accounts: ProviderAccount[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export async function registerProvider(input: RegistrationInput): Promise<{
  success: boolean;
  error?: string;
  account?: ProviderAccount;
}> {
  const errors = validateRegistration(input);
  if (hasRegistrationErrors(errors)) {
    return { success: false, error: Object.values(errors).find((value) => value.length > 0) ?? "بيانات غير صالحة" };
  }

  const result = await registerProviderWithPhone({
    fullName: input.fullName,
    phone: input.phone,
    password: input.password,
    metadata: { role: input.role },
  });
  if ("error" in result) {
    return { success: false, error: result.error };
  }

  const account: ProviderAccount = {
    id: result.user.id,
    fullName: result.user.display_name,
    role: (input.role ?? result.user.metadata?.role ?? "طبيب") as ProviderRole,
    phone: result.user.phone,
    passwordHash: result.user.password_hash,
    createdAt: Date.parse(result.user.created_at) || Date.now(),
    status: "pending",
    specializations: [],
    yearsOfExperience: 0,
    bio: "",
    documents: [],
    services: [],
    availability: { availableNow: true, slots: [] },
  };

  try {
    await createNotification({
      recipientId: "admin",
      role: "admin",
      type: "pending_provider",
      channel: "admin",
      title: "حساب شريك جديد بانتظار الموافقة",
      body: `سجّل ${account.role} جديد باسم «${account.fullName}» (${account.phone}). راجع المستندات وفعّل الحساب من لوحة التحكم.`,
    });
  } catch {
    // لا يُفشل التسجيل تعذّر إنشاء الإشعار
  }

  return { success: true, account };
}

export async function completeProviderProfile(
  accountId: string,
  input: ProfileCompletionInput,
): Promise<{ success: boolean; error?: string; account?: ProviderAccount }> {
  const errors = validateProfileCompletion(input);
  if (hasProfileErrors(errors)) {
    return { success: false, error: errors.specializations };
  }

  const existing = await getUserById(accountId);
  if (!existing) {
    return { success: false, error: "الحساب غير موجود" };
  }

  const updated: ProviderAccount = {
    id: existing.id,
    fullName: existing.display_name,
    role: (existing.metadata?.role ?? "طبيب") as ProviderRole,
    phone: existing.phone,
    passwordHash: existing.password_hash,
    createdAt: Date.parse(existing.created_at) || Date.now(),
    status: "pending",
    specializations: input.specializations,
    yearsOfExperience: input.yearsOfExperience,
    bio: input.bio.trim(),
    photoUri: input.photoUri,
    documents: input.documents,
    services: input.services,
    availability: input.availability,
  };

  await updateUserMetadata(accountId, {
    specializations: input.specializations,
    yearsOfExperience: input.yearsOfExperience,
    bio: input.bio.trim(),
    photoUri: input.photoUri,
    documents: input.documents,
    services: input.services,
    availability: input.availability,
  });
  return { success: true, account: updated };
}

/**
 * تنشيط حساب بعد موافقة الإدارة على المستندات (يُستخدم لاحقًا من لوحة التحكم).
 * المستندات لا يراها المريض قبل هذا التفعيل.
 */
export async function activateProviderAccount(accountId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await updateUserStatus(accountId, "active");
    return { success: true };
  } catch (error) {
    console.error("[provider-auth] activate failed:", error);
    return { success: false, error: "تعذر تفعيل الحساب؛ تحقق من اتصالك بالإنترنت." };
  }
}

export async function signInProvider(phone: string, password: string): Promise<{
  success: boolean;
  error?: string;
  account?: ProviderAccount;
}> {
  const result = await signInProviderWithPhone(phone.replace(/\s+/g, ""), password);
  if ("error" in result) {
    return { success: false, error: result.error };
  }
  const account: ProviderAccount = {
    id: result.user.id,
    fullName: result.user.display_name,
    role: (result.user.metadata?.role ?? "طبيب") as ProviderRole,
    phone: result.user.phone,
    passwordHash: result.user.password_hash,
    createdAt: Date.parse(result.user.created_at) || Date.now(),
    status: result.user.status === "active" ? "active" : "pending",
    specializations: ((result.user.metadata?.specializations as string[]) ?? []),
    yearsOfExperience: Number(result.user.metadata?.yearsOfExperience ?? 0),
    bio: String(result.user.metadata?.bio ?? ""),
    documents: ((result.user.metadata?.documents as ProviderDocument[]) ?? []),
    services: ((result.user.metadata?.services as ProviderService[]) ?? []),
    availability: ((result.user.metadata?.availability as ProviderAvailability) ?? { availableNow: true, slots: [] }),
    photoUri: result.user.metadata?.photoUri as string | undefined,
  };
  if (!(await verifyProviderPassword(account.passwordHash, password))) {
    return { success: false, error: "كلمة المرور غير صحيحة" };
  }

  // الجلسة محفوظة عبر رمز مشترك في tabibi_sessions، والهاش الجديد يُحفّظ في Supabase عند إكمال البيانات.
  return { success: true, account };
}

export async function getSessionAccount(): Promise<ProviderAccount | null> {
  const state = await getAuthState();
  if (!state) return null;
  const { user } = state;
  const account: ProviderAccount = {
    id: user.id,
    fullName: user.display_name,
    role: (user.metadata?.role ?? "طبيب") as ProviderRole,
    phone: user.phone,
    passwordHash: user.password_hash,
    createdAt: Date.parse(user.created_at) || Date.now(),
    status: user.status === "active" ? "active" : "pending",
    specializations: ((user.metadata?.specializations as string[]) ?? []),
    yearsOfExperience: Number(user.metadata?.yearsOfExperience ?? 0),
    bio: String(user.metadata?.bio ?? ""),
    documents: ((user.metadata?.documents as ProviderDocument[]) ?? []),
    services: ((user.metadata?.services as ProviderService[]) ?? []),
    availability: ((user.metadata?.availability as ProviderAvailability) ?? { availableNow: true, slots: [] }),
    photoUri: user.metadata?.photoUri as string | undefined,
  };
  if (!Array.isArray(account.specializations)) account.specializations = [];
  if (typeof account.yearsOfExperience !== "number") account.yearsOfExperience = 0;
  if (typeof account.bio !== "string") account.bio = "";
  if (!Array.isArray(account.documents)) account.documents = [];
  if (!Array.isArray(account.services)) account.services = [];
  if (!account.availability || typeof account.availability !== "object") {
    account.availability = { availableNow: true, slots: [] };
  }
  if (typeof account.availability.availableNow !== "boolean") {
    account.availability.availableNow = true;
  }
  if (!Array.isArray(account.availability.slots)) account.availability.slots = [];
  if (account.status !== "pending" && account.status !== "active") account.status = "pending";
  return account;
}

export async function signOutProvider(): Promise<void> {
  await signOutProviderSupabase();
}

/**
 * تحديث قائمة خدمات مقدم الخدمة (الاسم والسعر والمدة).
 */
export async function updateProviderServices(
  accountId: string,
  services: ProviderService[],
): Promise<{ success: boolean; error?: string; account?: ProviderAccount }> {
  try {
    await updateUserMetadata(accountId, { services });
    return { success: true, account: { ...(await getSessionAccount())!, services } };
  } catch (error) {
    console.error("[provider-auth] services update failed:", error);
    return { success: false, error: "تعذر حفظ الخدمات؛ تحقق من اتصالك." };
  }
}

/**
 * تحديث جدولة التوفر: متاح الآن أو أيام محددة بساعات معينة.
 */
export async function updateProviderAvailability(
  accountId: string,
  availability: ProviderAvailability,
): Promise<{ success: boolean; error?: string; account?: ProviderAccount }> {
  try {
    await updateUserMetadata(accountId, { availability });
    return { success: true, account: { ...(await getSessionAccount())!, availability } };
  } catch (error) {
    console.error("[provider-auth] availability update failed:", error);
    return { success: false, error: "تعذر حفظ التوفر؛ تحقق من اتصالك." };
  }
}
