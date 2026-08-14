/**
 * نظام طلبات الخدمات (المشترك بين تطبيق المريض وتطبيق طبيب شريك).
 *
 * في هذه المرحلة تُخزن الطلبات في التخزين المحلي عبر مفتاح مشترك:
 * service_requests_v1
 *
 * يقرأ تطبيق طبيب شريك نفس المفتاح لعرض الطلبات الواردة لكل مقدم خدمة،
 * وعند توصيل خادم لاحقًا ينتقل التخزين إلى الخادم دون تغيير الواجهة.
 *
 * حالة الطلب: pending (قيد الانتظار) → accepted (مقبول) / rejected (مرفوض)
 *
 * الدفع:
 * - paymentMethod: طريقة الدفع المختارة عند الطلب (نقدي / إلكتروني)
 * - paymentStatus: awaiting_provider_acceptance (قبل القبول) → payment_pending
 *   (بعد قبول الشريك إذا كان الدفع إلكترونيًا) → confirmed (بعد تأكيد الدفع أو تأكيد النقدي)
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ServiceRequestStatus = "pending" | "accepted" | "rejected" | "completed" | "cancelled";

export type PaymentMethod = "cash" | "electronic";

export type PaymentStatus = "awaiting_provider_acceptance" | "payment_pending" | "confirmed";

export type ServiceRequestItem = {
  serviceId: string;
  serviceName: string;
  price: number;
  durationMinutes?: number;
};

export type ServiceRequest = {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: ServiceRequestStatus;
  patientId: string;
  patientName: string;
  patientPhone: string;
  addressLabel?: string;
  addressDetails?: string;
  providerId: string;
  providerName: string;
  specialtyLabel?: string;
  services: ServiceRequestItem[];
  total: number;
  notes?: string;
  providerReply?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  paymentConfirmedAt?: number;
};

export const SERVICE_REQUESTS_KEY = "service_requests_v1";

function genId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function parseStatus(value: unknown): ServiceRequestStatus {
  if (value === "pending" || value === "accepted" || value === "rejected" || value === "completed" || value === "cancelled") {
    return value;
  }
  return "pending";
}

/** قراءة جميع طلبات الخدمة من التخزين المحلي */
export async function readServiceRequests(): Promise<ServiceRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(SERVICE_REQUESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ServiceRequest => {
      return (
        !!item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.patientId === "string" &&
        typeof item.providerId === "string" &&
        Array.isArray(item.services) &&
        typeof item.total === "number"
      );
    });
  } catch {
    return [];
  }
}

/** قراءة طلبات مريض محدد */
export async function readPatientRequests(patientId: string): Promise<ServiceRequest[]> {
  const all = await readServiceRequests();
  return all.filter((request) => request.patientId === patientId);
}

/** قراءة الطلبات الموجهة لمقدم خدمة محدد */
export async function readProviderRequests(providerId: string): Promise<ServiceRequest[]> {
  const all = await readServiceRequests();
  return all.filter((request) => request.providerId === providerId);
}

/** إنشاء طلب جديد بحالة قيد الانتظار */
export async function createServiceRequest(input: {
  patientId: string;
  patientName: string;
  patientPhone: string;
  addressLabel?: string;
  addressDetails?: string;
  providerId: string;
  providerName: string;
  specialtyLabel?: string;
  services: ServiceRequestItem[];
  total: number;
  notes?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
}): Promise<ServiceRequest> {
  const request: ServiceRequest = {
    ...input,
    id: genId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "pending",
    paymentStatus: input.paymentMethod ? "awaiting_provider_acceptance" : undefined,
  };
  const all = await readServiceRequests();
  await AsyncStorage.setItem(SERVICE_REQUESTS_KEY, JSON.stringify([...all, request]));
  return request;
}

/** تحديث حالة طلب (قبول / رفض) من تطبيق طبيب شريك */
export async function updateRequestStatus(
  requestId: string,
  status: ServiceRequestStatus,
  providerReply?: string,
): Promise<ServiceRequest | null> {
  const all = await readServiceRequests();
  const index = all.findIndex((request) => request.id === requestId);
  if (index === -1) return null;
  const request = all[index];
  const updated: ServiceRequest = {
    ...request,
    status,
    providerReply,
    updatedAt: Date.now(),
  };
  all[index] = updated;
  await AsyncStorage.setItem(SERVICE_REQUESTS_KEY, JSON.stringify(all));
  return updated;
}

export function parsePaymentMethod(value: unknown): PaymentMethod | undefined {
  if (value === "cash" || value === "electronic") return value;
  return undefined;
}

export function parsePaymentStatus(value: unknown): PaymentStatus | undefined {
  if (value === "awaiting_provider_acceptance" || value === "payment_pending" || value === "confirmed") {
    return value;
  }
  return undefined;
}

/** تحديث حالة الدفع بعد قبول مقدم الخدمة (إلكتروني ينتقل إلى payment_pending) */
export async function updatePaymentStatus(
  requestId: string,
  paymentStatus: PaymentStatus,
): Promise<ServiceRequest | null> {
  const all = await readServiceRequests();
  const index = all.findIndex((request) => request.id === requestId);
  if (index === -1) return null;
  const request = all[index];
  const updated: ServiceRequest = {
    ...request,
    paymentStatus,
    paymentConfirmedAt: paymentStatus === "confirmed" ? Date.now() : request.paymentConfirmedAt,
    updatedAt: Date.now(),
  };
  all[index] = updated;
  await AsyncStorage.setItem(SERVICE_REQUESTS_KEY, JSON.stringify(all));
  return updated;
}
