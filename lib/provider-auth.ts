import AsyncStorage from "@react-native-async-storage/async-storage";
import { type ProviderAvailability, type ProviderService } from "./provider-services";

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
 * الشكل: "sha256:{salt-hex}:{hex-digest}"
 */
export async function hashPasswordStrong(password: string, salt?: string): Promise<string> {
  const { getRandomBytesAsync, digestStringAsync, CryptoDigestAlgorithm, CryptoEncoding } = await import("expo-crypto");
  const saltHex = salt ?? Array.from(await getRandomBytesAsync(16)).map((byte: number) => byte.toString(16).padStart(2, "0")).join("");
  const digestHex = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${saltHex}:${password}`, { encoding: CryptoEncoding.HEX });
  return `sha256:${saltHex}:${digestHex}`;
}

export function isStrongProviderHash(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[0-9a-f]{32}:/.test(value);
}

/** التحقق من كلمة المرور: يقبل الشكل القوي الجديد والشكل القديم للترحيل التدريجي */
export async function verifyProviderPassword(stored: unknown, password: string): Promise<boolean> {
  if (isStrongProviderHash(stored)) {
    const [, saltHex] = stored.split(":");
    return (await hashPasswordStrong(password, saltHex)) === stored;
  }
  return typeof stored === "number" && stored === hashPassword(password);
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

  const phone = input.phone.replace(/\s+/g, "");
  const phoneDigits = phone.replace(/\D/g, "");
  if (!phone) {
    errors.phone = "يرجى إدخال رقم الهاتف";
  } else if (!/^\+2189\d{8}$/.test(phone) && !/^09\d{8}$/.test(phoneDigits)) {
    errors.phone = "رقم الهاتف غير صالح، أدخل رقمًا ليبيًا بصيغة +2189XXXXXXXX أو 09XXXXXXXX (10 خانات تبدأ بـ 09)";
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

  const accounts = await listProviderAccounts();
  const phone = input.phone.replace(/\s+/g, "");
  const duplicate = accounts.find((account) => account.phone === phone);
  if (duplicate) {
    return { success: false, error: "يوجد حساب مسجل بهذا الرقم مسبقًا" };
  }

  const account: ProviderAccount = {
    id: `provider-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fullName: input.fullName.trim(),
    role: input.role,
    phone,
    passwordHash: await hashPasswordStrong(input.password),
    createdAt: Date.now(),
    status: "pending",
    specializations: [],
    yearsOfExperience: 0,
    bio: "",
    documents: [],
    services: [],
    availability: { availableNow: true, slots: [] },
  };

  await saveProviderAccounts([...accounts, account]);

  // إشعار الإدارة بتسجيل شريك جديد بانتظار الموافقة (مفاتيح التشغيل يدويًا من لوحة التحكم)
  try {
    const { createNotification } = await import("./notifications");
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

  const accounts = await listProviderAccounts();
  const accountIndex = accounts.findIndex((account) => account.id === accountId);
  if (accountIndex === -1) {
    return { success: false, error: "الحساب غير موجود" };
  }

  const updated: ProviderAccount = {
    ...accounts[accountIndex],
    specializations: input.specializations,
    yearsOfExperience: input.yearsOfExperience,
    bio: input.bio.trim(),
    photoUri: input.photoUri,
    documents: input.documents,
    services: input.services,
    availability: input.availability,
    status: "pending",
  };

  const nextAccounts = [...accounts];
  nextAccounts[accountIndex] = updated;
  await saveProviderAccounts(nextAccounts);
  await AsyncStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(updated));
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
  const accounts = await listProviderAccounts();
  const accountIndex = accounts.findIndex((account) => account.id === accountId);
  if (accountIndex === -1) {
    return { success: false, error: "الحساب غير موجود" };
  }

  const nextAccounts = [...accounts];
  nextAccounts[accountIndex] = { ...nextAccounts[accountIndex], status: "active" };
  await saveProviderAccounts(nextAccounts);
  return { success: true };
}

export async function signInProvider(phone: string, password: string): Promise<{
  success: boolean;
  error?: string;
  account?: ProviderAccount;
}> {
  const normalizedPhone = phone.replace(/\s+/g, "");
  const accounts = await listProviderAccounts();
  const account = accounts.find((candidate) => candidate.phone === normalizedPhone);

  if (!account) {
    return { success: false, error: "لا يوجد حساب بهذا الرقم، أنشئ حسابًا أولًا" };
  }

  if (!(await verifyProviderPassword(account.passwordHash, password))) {
    return { success: false, error: "كلمة المرور غير صحيحة" };
  }

  // ترقية التجزئة الضعيفة القديمة (djb2) إلى SHA-256 مع salt عند الدخول الناجح.
  if (!isStrongProviderHash(account.passwordHash)) {
    const accounts = await listProviderAccounts();
    const index = accounts.findIndex((candidate) => candidate.id === account.id);
    if (index !== -1) {
      accounts[index] = { ...accounts[index], passwordHash: await hashPasswordStrong(password) };
      await saveProviderAccounts(accounts);
      await AsyncStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(accounts[index]));
      return { success: true, account: accounts[index] };
    }
  }

  await AsyncStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(account));
  return { success: true, account };
}

export async function getSessionAccount(): Promise<ProviderAccount | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || typeof parsed.id !== "string") return null;
    const account = parsed as ProviderAccount;
    // تحمل الجلسات المحفوظة بنموذج قديم قبل إضافة الحقول الجديدة
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
  } catch {
    return null;
  }
}

export async function signOutProvider(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_SESSION_KEY);
}

/**
 * تحديث قائمة خدمات مقدم الخدمة (الاسم والسعر والمدة).
 */
export async function updateProviderServices(
  accountId: string,
  services: ProviderService[],
): Promise<{ success: boolean; error?: string; account?: ProviderAccount }> {
  const accounts = await listProviderAccounts();
  const accountIndex = accounts.findIndex((account) => account.id === accountId);
  if (accountIndex === -1) {
    return { success: false, error: "الحساب غير موجود" };
  }
  const updated: ProviderAccount = { ...accounts[accountIndex], services };
  const nextAccounts = [...accounts];
  nextAccounts[accountIndex] = updated;
  await saveProviderAccounts(nextAccounts);
  return { success: true, account: updated };
}

/**
 * تحديث جدولة التوفر: متاح الآن أو أيام محددة بساعات معينة.
 */
export async function updateProviderAvailability(
  accountId: string,
  availability: ProviderAvailability,
): Promise<{ success: boolean; error?: string; account?: ProviderAccount }> {
  const accounts = await listProviderAccounts();
  const accountIndex = accounts.findIndex((account) => account.id === accountId);
  if (accountIndex === -1) {
    return { success: false, error: "الحساب غير موجود" };
  }
  const updated: ProviderAccount = { ...accounts[accountIndex], availability };
  const nextAccounts = [...accounts];
  nextAccounts[accountIndex] = updated;
  await saveProviderAccounts(nextAccounts);
  return { success: true, account: updated };
}
