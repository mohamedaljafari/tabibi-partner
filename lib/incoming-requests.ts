/**
 * الطلبات الواردة لمقدم الخدمة (من تطبيق المريض).
 *
 * يشارك هذا الملف مفتاح التخزين مع تطبيق المريض
 * (service_requests_v1) ليقرأ مقدم الخدمة طلبات خدمة المريض
 * المستهدفة لحسابه ويستجيب لها (قبول/رفض/إكمال).
 *
 * بما أن التطبيقين منفصلان وبياناتهما محلية، فإن قراءة الطلبات
 * هنا تعتمد على أن الطلب خُزن في نفس جهاز تطبيق المريض؛ وعند
 * ربط الخادم المشترك لاحقًا ستتحول هذه الدوال إلى استدعاءات
 * الخادم دون تغيير نموذج الطلب.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export const SERVICE_REQUESTS_KEY = "service_requests_v1";

export type IncomingServiceRequest = {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: "pending" | "accepted" | "rejected" | "completed" | "cancelled";
  patientId: string;
  patientName: string;
  patientPhone: string;
  addressLabel: string;
  addressDetails?: string;
  providerId: string;
  providerName: string;
  specialtyLabel: string;
  services: Array<{
    serviceId: string;
    serviceName: string;
    price: number;
    durationMinutes?: number;
  }>;
  total: number;
  /** طريقة الدفع المختارة: نقدي أو إلكتروني */
  paymentMethod?: "cash" | "electronic";
  /**
   * حالة الدفع وفق آلية المنصة:
   * - awaiting_provider_acceptance: انتظر قبول مقدم الخدمة قبل ظهور خيارات الدفع
   * - payment_pending: قُبل الطلب والمريض يختار الدفع (نقدي/إلكتروني)
   * - confirmed: تأكيد الدفع النهائي (نقدي مؤكد أو إلكتروني مكتمل)
   */
  paymentStatus?: "awaiting_provider_acceptance" | "payment_pending" | "confirmed";
  /** رسالة أو ملاحظات من المريض عند إرسال الطلب */
  notes?: string;
  /** ملاحظات مقدم الخدمة عند الرد على الطلب */
  providerNotes?: string;
  /** وقت الرد الفعلي (قبول/رفض) */
  respondedAt?: number;
};

export function isRequestForProvider(request: unknown, providerId: string): request is IncomingServiceRequest {
  if (!request || typeof request !== "object") return false;
  const candidate = request as IncomingServiceRequest;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.createdAt === "number" &&
    typeof candidate.status === "string" &&
    typeof candidate.patientName === "string" &&
    typeof candidate.patientPhone === "string" &&
    typeof candidate.addressLabel === "string" &&
    typeof candidate.providerId === "string" &&
    candidate.providerId === providerId &&
    typeof candidate.providerName === "string" &&
    typeof candidate.specialtyLabel === "string" &&
    Array.isArray(candidate.services) &&
    typeof candidate.total === "number"
  );
}

export function parseRequestStatus(status: unknown): IncomingServiceRequest["status"] | null {
  if (status === "pending" || status === "accepted" || status === "rejected" || status === "completed" || status === "cancelled") {
    return status;
  }
  return null;
}

/** يقرأ جميع الطلبات الواردة لمقدم خدمة محدد بحسابه الفعّال. */
export async function readIncomingRequests(providerId: string): Promise<IncomingServiceRequest[]> {
  const raw = await AsyncStorage.getItem(SERVICE_REQUESTS_KEY);
  if (!raw) return [];

  let parsed: unknown[];
  try {
    const decoded = JSON.parse(raw) as unknown;
    parsed = Array.isArray(decoded) ? decoded : [];
  } catch {
    return [];
  }

  return parsed
    .filter((candidate): candidate is IncomingServiceRequest => isRequestForProvider(candidate, providerId))
    .sort((first, second) => second.createdAt - first.createdAt);
}

/** يعدّل حالة الطلب الموجه لمقدم خدمة معين ويحفظه. */
export async function updateIncomingRequestStatus(
  requestId: string,
  providerId: string,
  status: IncomingServiceRequest["status"],
  providerNotes?: string,
): Promise<IncomingServiceRequest | null> {
  const raw = await AsyncStorage.getItem(SERVICE_REQUESTS_KEY);
  if (!raw) return null;

  let parsed: unknown[];
  try {
    const decoded = JSON.parse(raw) as unknown;
    parsed = Array.isArray(decoded) ? decoded : [];
  } catch {
    return null;
  }

  const now = Date.now();
  const updated: unknown[] = parsed.map((candidate) => {
    if (!isRequestForProvider(candidate, providerId) || candidate.id !== requestId) {
      return candidate;
    }
    const target: IncomingServiceRequest = {
      ...candidate,
      status,
      updatedAt: now,
      respondedAt: now,
    };
    if (providerNotes?.trim()) {
      target.providerNotes = providerNotes.trim();
    }
    return target;
  });

  await AsyncStorage.setItem(SERVICE_REQUESTS_KEY, JSON.stringify(updated));
  const match = updated.find((candidate): candidate is IncomingServiceRequest =>
    isRequestForProvider(candidate, providerId) && candidate.id === requestId,
  );
  return match ?? null;
}
