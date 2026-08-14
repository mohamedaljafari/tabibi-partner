/**
 * نظام التقييمات (المشترك بين تطبيق المريض وتطبيق طبيب شريك).
 *
 * المفتاح المشترك: ratings_v1
 * المريض يقيّم مقدم الخدمة بعد إتمام الخدمة (نجوم 1-5 + تعليق اختياري)،
 * ويقرأ تطبيق الشريك تقييماته لعرض المتوسط وعدد التقييمات.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export const RATINGS_KEY = "ratings_v1";

export const MIN_RATING = 1;
export const MAX_RATING = 5;

export type ProviderRating = {
  id: string;
  /** معرّف الطلب الذي تم التقييم عليه */
  requestId: string;
  /** معرّف المريض المقيّم */
  patientId: string;
  patientName: string;
  /** معرّف مقدم الخدمة المقيَّم */
  providerId: string;
  providerName: string;
  /** التقييم بالنجوم من 1 إلى 5 */
  stars: number;
  /** تعليق نصي اختياري */
  comment?: string;
  createdAt: number;
};

export type RatingSummary = {
  providerId: string;
  average: number;
  count: number;
};

function genId(): string {
  return `rt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** قراءة جميع التقييمات من التخزين المشترك */
export async function readRatings(): Promise<ProviderRating[]> {
  try {
    const raw = await AsyncStorage.getItem(RATINGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ProviderRating => {
      return (
        !!item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.providerId === "string" &&
        typeof item.patientId === "string" &&
        typeof item.requestId === "string" &&
        typeof item.stars === "number"
      );
    });
  } catch {
    return [];
  }
}

/** التحقق من صحة نجوم التقييم */
export function validateStars(value: unknown): number | null {
  if (typeof value !== "number") return null;
  if (!Number.isInteger(value)) return null;
  if (value < MIN_RATING || value > MAX_RATING) return null;
  return value;
}

/** التحقق من طلب تقييم جديد */
export function validateNewRating(input: {
  requestId: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  stars: unknown;
  comment?: string;
}): { valid: true; stars: number; comment?: string } | { valid: false; error: string } {
  if (typeof input.requestId !== "string" || input.requestId.length === 0) {
    return { valid: false, error: "الطلب غير صالح" };
  }
  if (typeof input.patientId !== "string" || input.patientId.length === 0) {
    return { valid: false, error: "بيانات المريض غير صالحة" };
  }
  if (typeof input.providerId !== "string" || input.providerId.length === 0) {
    return { valid: false, error: "بيانات مقدم الخدمة غير صالحة" };
  }
  const stars = validateStars(input.stars);
  if (stars === null) {
    return { valid: false, error: `التقييم يجب أن يكون بين ${MIN_RATING} و${MAX_RATING} نجوم` };
  }
  if (input.comment !== undefined && typeof input.comment !== "string") {
    return { valid: false, error: "التعليق غير صالح" };
  }
  if (typeof input.comment === "string" && input.comment.length > 500) {
    return { valid: false, error: "التعليق طويل جدًا (الحد الأقصى 500 حرف)" };
  }
  return { valid: true, stars, comment: input.comment };
}

/** التقييم على طلب مكتمل فقط، ومنع التقييم المكرر لنفس الطلب */
export async function createRating(input: {
  requestId: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  stars: number;
  comment?: string;
}): Promise<{ rating: ProviderRating | null; error?: string }> {
  const validation = validateNewRating(input);
  if (!validation.valid) {
    return { rating: null, error: validation.error };
  }
  const all = await readRatings();
  const existing = all.find((rating) => rating.requestId === input.requestId);
  if (existing) {
    return { rating: null, error: "تم تقييم هذا الطلب مسبقًا" };
  }
  const rating: ProviderRating = {
    id: genId(),
    requestId: input.requestId,
    patientId: input.patientId,
    patientName: input.patientName,
    providerId: input.providerId,
    providerName: input.providerName,
    stars: validation.stars,
    comment: input.comment ? input.comment.trim() || undefined : undefined,
    createdAt: Date.now(),
  };
  await AsyncStorage.setItem(RATINGS_KEY, JSON.stringify([...all, rating]));
  return { rating };
}

/** ملخص تقييمات مقدم خدمة واحد (المتوسط وعدد التقييمات) */
export async function getProviderRatingSummary(providerId: string): Promise<RatingSummary> {
  const all = await readRatings();
  const ratings = all.filter((rating) => rating.providerId === providerId);
  const count = ratings.length;
  const average = count > 0 ? ratings.reduce((sum, rating) => sum + rating.stars, 0) / count : 0;
  return { providerId, average: Math.round(average * 10) / 10, count };
}

/** ملخصات تقييمات لعدة مقدمي خدمة دفعة واحدة (لنتائج البحث) */
export async function getProviderRatingSummaries(providerIds: string[]): Promise<RatingSummary[]> {
  const all = await readRatings();
  const summaries: RatingSummary[] = [];
  for (const providerId of providerIds) {
    const ratings = all.filter((rating) => rating.providerId === providerId);
    const count = ratings.length;
    const average =
      count > 0 ? Math.round((ratings.reduce((sum, rating) => sum + rating.stars, 0) / count) * 10) / 10 : 0;
    summaries.push({ providerId, average, count });
  }
  return summaries;
}

/** آخر تقييمات مقدم خدمة (لعرض التعليقات) */
export async function getProviderRatings(providerId: string, limit = 10): Promise<ProviderRating[]> {
  const all = await readRatings();
  return all
    .filter((rating) => rating.providerId === providerId)
    .sort((first, second) => second.createdAt - first.createdAt)
    .slice(0, limit);
}

/** هل قيّم المريض هذا الطلب بالفعل؟ */
export async function isRequestRated(requestId: string): Promise<boolean> {
  const all = await readRatings();
  return all.some((rating) => rating.requestId === requestId);
}
