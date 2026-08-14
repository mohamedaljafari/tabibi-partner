/**
 * مكتبة أطباء الاستشارات الطبية (منظور طبيب شريك).
 *
 * في تطبيق الشريك، أطباء الاستشارات المحليون هم حساب الشريك نفسه
 * (مقدم الخدمة المسجّل)؛ أما الأطباء الخارجيون فيُدارون يدويًا
 * من لوحة التحكم ويخزَّنون محليًا في AsyncStorage.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export const CONSULTATION_STORAGE_KEY = "tabibi.consultations.v1";

export type ConsultationType = "local" | "international";

/** طبيب استشارة خارجي (يُدار من لوحة التحكم) */
export type ExternalConsultationDoctor = {
  id: string;
  name: string;
  /** الدولة/المقر الخارجي (مثل "مصر"، "تركيا") */
  country: string;
  /** نص التخصص (مثل "جلدية") */
  specialty: string;
  /** سنوات الخبرة */
  experience: number;
  /** سعر الاستشارة بالدينار الليبي */
  price: number;
  /** الحروف الأولى من الاسم تُعرض كصورة رمزية */
  initials: string;
  enabled: boolean;
  createdAt: number;
};

export type LocalConsultationDoctor = {
  id: string;
  fullName: string;
  initials: string;
  enabled: boolean;
  consultationType: Extract<ConsultationType, "local">;
  createdAt: number;
};

export type ConsultationDoctor =
  | (LocalConsultationDoctor & { consultationType: Extract<ConsultationType, "local"> })
  | (ExternalConsultationDoctor & { consultationType: Extract<ConsultationType, "international"> });

// ───────────────────── دوال التخزين ─────────────────────

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // تجاهل أخطاء الكتابة (مثل امتلاء التخزين)
  }
}

function genId(): string {
  return `exdoc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** قراءة جميع الأطباء الخارجيين (المفعّلين وغير المفعّلين) */
export async function readExternalDoctors(): Promise<ExternalConsultationDoctor[]> {
  return readJson<ExternalConsultationDoctor[]>(CONSULTATION_STORAGE_KEY, []);
}

/** حفظ قائمة الأطباء الخارجيين كاملة */
export async function writeExternalDoctors(
  doctors: ExternalConsultationDoctor[],
): Promise<ExternalConsultationDoctor[]> {
  await writeJson(CONSULTATION_STORAGE_KEY, doctors);
  return doctors;
}

/** الأطباء الخارجيون المفعّلون فقط */
export async function readActiveExternalDoctors(): Promise<ExternalConsultationDoctor[]> {
  const all = await readExternalDoctors();
  return all.filter((doctor) => doctor.enabled);
}

/** إضافة طبيب خارجي جديد */
export async function addExternalDoctor(
  input: Omit<ExternalConsultationDoctor, "id" | "createdAt">,
): Promise<ExternalConsultationDoctor[]> {
  const all = await readExternalDoctors();
  const doctor: ExternalConsultationDoctor = {
    ...input,
    id: genId(),
    createdAt: Date.now(),
  };
  return writeExternalDoctors([...all, doctor]);
}

/** تحديث طبيب خارجي */
export async function updateExternalDoctor(
  id: string,
  input: Partial<Omit<ExternalConsultationDoctor, "id" | "createdAt">>,
): Promise<ExternalConsultationDoctor[]> {
  const all = await readExternalDoctors();
  const next = all.map((doctor) =>
    doctor.id === id ? ({ ...doctor, ...input } as ExternalConsultationDoctor) : doctor,
  );
  return writeExternalDoctors(next);
}

/** تفعيل أو إيقاف طبيب خارجي */
export async function toggleExternalDoctor(id: string): Promise<ExternalConsultationDoctor[]> {
  const all = await readExternalDoctors();
  const next = all.map((doctor) =>
    doctor.id === id ? ({ ...doctor, enabled: !doctor.enabled } as ExternalConsultationDoctor) : doctor,
  );
  return writeExternalDoctors(next);
}

/** حذف طبيب خارجي */
export async function removeExternalDoctor(id: string): Promise<ExternalConsultationDoctor[]> {
  const all = await readExternalDoctors();
  return writeExternalDoctors(all.filter((doctor) => doctor.id !== id));
}

/**
 * أطباء الاستشارات المحليون النشطون.
 * في تطبيق الشريك يمثلهم حساب الشريك نفسه عند تفعيل الاستشارات
 * — هنا نتحقق من وجود حساب نشط فقط.
 */
export async function readLocalConsultationDoctors(
  currentProviderId: string,
): Promise<ConsultationDoctor[]> {
  if (!currentProviderId) return [];
  const { getSessionAccount } = await import("./provider-auth");
  const account = await getSessionAccount();
  if (!account || account.id !== currentProviderId) return [];
  return [
    {
      id: account.id,
      fullName: account.fullName,
      initials: account.fullName
        ? account.fullName
            .split(" ")
            .slice(0, 2)
            .map((part) => part.charAt(0))
            .join("")
        : "ط",
      enabled: account.status === "active",
      consultationType: "local" as const,
      createdAt: account.createdAt ?? Date.now(),
    },
  ];
}

/** قراءة قائمة أطباء الاستشارة (محليون + خارجيون) للعرض */
export async function readAllConsultationDoctors(
  currentProviderId: string,
): Promise<ConsultationDoctor[]> {
  const [local, external] = await Promise.all([
    readLocalConsultationDoctors(currentProviderId),
    readActiveExternalDoctors(),
  ]);
  return [
    ...local,
    ...external.map((doctor) => ({ ...doctor, consultationType: "international" as const })),
  ];
}

