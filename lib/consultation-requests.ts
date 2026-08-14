/**
 * نظام طلبات الاستشارات الطبية (داخل وخارج ليبيا).
 *
 * يخزن طلبات الاستشارة محليًا في AsyncStorage بمفتاح مستقل
 * (consultation_requests_v1). تظهر الطلبات للمريض في تبويب «طلباتي»،
 * ويمكن لاحقًا دمجها مع نظام الطلبات المشترك.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ConsultationType } from "./consultation-doctors";
import type { Notification as LocalNotification } from "./notifications";

export type ConsultationRequestStatus = "pending" | "accepted" | "rejected" | "completed" | "cancelled";

export type ConsultationMode = "instant" | "scheduled";

/**
 * قاعدة الدفع للاستشارات (خدمة عن بُعد online):
 * الدفع إلكتروني فقط، ويُدفع قبل تقديم الخدمة. لا يوجد دفع نقدي
 * للاستشارات على الإطلاق.
 */
export type ConsultationPaymentStatus = "payment_pending" | "confirmed";

export type ConsultationRequest = {
  id: string;
  type: ConsultationType;
  mode: ConsultationMode;
  /** توقيت الموعد لطلب الحجز المسبق (timestamp)، فارغة للطلب الفوري */
  scheduledAt?: number;
  /** اسم الطبيب خارج ليبيا عند التسجيل اليدوي من لوحة التحكم */
  externalDoctorName?: string;
  externalDoctorCountry?: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  specialtyLabel: string;
  doctorId: string;
  doctorName: string;
  price: number;
  status: ConsultationRequestStatus;
  /** حالة الدفع: payment_pending حتى يدفع المريض إلكترونيًا، ثم confirmed */
  paymentStatus: ConsultationPaymentStatus;
  paymentConfirmedAt?: number;
  completedAt?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

export const CONSULTATION_REQUESTS_KEY = "consultation_requests_v1";

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function readConsultationRequests(): Promise<ConsultationRequest[]> {
  return readJson<ConsultationRequest[]>(CONSULTATION_REQUESTS_KEY, []);
}

/** إنشاء طلب استشارة جديد بمعرفة كاملة من الحقول المطلوبة */
export async function submitConsultationRequest(
  request: ConsultationRequest,
): Promise<ConsultationRequest[]> {
  const all = await readConsultationRequests();
  const next = [...all, request];
  await writeJson(CONSULTATION_REQUESTS_KEY, next);
  return next;
}

/** إنشاء طلب استشارة بفرض جميع الحقول الأساسية (منع الأخطاء أثناء البناء) */
export async function createConsultationRequest(input: {
  type: ConsultationType;
  mode: ConsultationMode;
  scheduledAt?: number;
  patientId: string;
  patientName: string;
  patientPhone: string;
  specialtyLabel: string;
  doctorId: string;
  doctorName: string;
  externalDoctorName?: string;
  externalDoctorCountry?: string;
  price: number;
  notes?: string;
}): Promise<ConsultationRequest> {
  const request: ConsultationRequest = {
    ...input,
    id: `con_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    status: "pending",
    paymentStatus: "payment_pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const all = await readConsultationRequests();
  await writeJson(CONSULTATION_REQUESTS_KEY, [...all, request]);
  return request;
}

/** قراءة طلبات مريض محدد */
export async function readPatientConsultationRequests(patientId: string): Promise<ConsultationRequest[]> {
  const all = await readConsultationRequests();
  return all.filter((request) => request.patientId === patientId);
}

/** تأكيد الدفع الإلكتروني للاستشارة (إلكتروني حصريًا، قبل الخدمة) */
export async function confirmConsultationPayment(
  id: string,
): Promise<ConsultationRequest | null> {
  const all = await readConsultationRequests();
  const index = all.findIndex((request) => request.id === id);
  if (index === -1) return null;
  all[index] = {
    ...all[index],
    paymentStatus: "confirmed",
    paymentConfirmedAt: Date.now(),
    updatedAt: Date.now(),
  };
  await writeJson(CONSULTATION_REQUESTS_KEY, all);
  return all[index];
}

export async function updateConsultationRequest(
  id: string,
  patch: Partial<ConsultationRequest>,
): Promise<ConsultationRequest[]> {
  const all = await readConsultationRequests();
  const next = all.map((request) =>
    request.id === id
      ? { ...request, ...patch, updatedAt: Date.now() }
      : request,
  );
  await writeJson(CONSULTATION_REQUESTS_KEY, next);
  return next;
}

export async function cancelConsultationRequest(id: string): Promise<ConsultationRequest[]> {
  return updateConsultationRequest(id, { status: "cancelled" });
}

/**
 * إتمام الاستشارة: يحوّل حالتها إلى completed.
 * يُستخدم من مقدم الخدمة (الشريك) عند انتهاء موعد الاستشارة،
 * فيُقفل الموضوع وتُطلب التقييم من المريض.
 */
export async function completeConsultationRequest(id: string): Promise<ConsultationRequest | null> {
  const all = await readConsultationRequests();
  const index = all.findIndex((request) => request.id === id);
  if (index === -1) return null;
  const request = all[index];
  all[index] = {
    ...request,
    status: "completed" as ConsultationRequestStatus,
    completedAt: Date.now(),
    updatedAt: Date.now(),
  };
  await writeJson(CONSULTATION_REQUESTS_KEY, all);
  return all[index];
}

/** قراءة طلب استشارة واحد بمعرفه */
export async function readConsultationRequest(id: string): Promise<ConsultationRequest | null> {
  const all = await readConsultationRequests();
  return all.find((request) => request.id === id) ?? null;
}

/**
 * إشعار المريض عند بدء موعد الاستشارة المحجوز لاحقًا.
 * تُستدعى من الشريك عند فتح جلسة الاستشارة في الموعد المتفق عليه.
 */
export async function notifyConsultationStarted(
  request: ConsultationRequest,
  doctorName: string,
): Promise<LocalNotification | null> {
  try {
    const { createNotification } = await import("./notifications");
    return await createNotification({
      recipientId: request.patientId,
      role: "patient",
      type: "consultation_started",
      requestId: request.id,
      otherPartyName: doctorName,
      title: "بدأت الاستشارة",
      body: `بدأ الطبيب ${doctorName} جلسة الاستشارة في الموعد المحدد. افتح الدردشة الآن.`,
    });
  } catch {
    return null;
  }
}

/**
 * قبول طلب الاستشارة وفتح محادثة مع مقدم الخدمة.
 * قاعدة: الدردشة لا تفتح إلا بعد القبول، سواء كان مقدم الخدمة
 * محليًا أو طبيبًا خارج ليبيا مسجلًا يدويًا من لوحة التحكم.
 * الدفع إلكتروني حصري للاستشارات؛ يجب أن يكون paymentStatus="confirmed"
 * قبل قبول الاستشارة من الطبيب الخارجي.
 */
export async function acceptConsultationRequest(
  id: string,
  doctorId: string,
  doctorName: string,
): Promise<ConsultationRequest[]> {
  const { openThread } = await import("./chat");
  const all = await readConsultationRequests();
  const request = all.find((request) => request.id === id);
  const next = all.map((request) =>
    request.id === id
      ? { ...request, status: "accepted" as ConsultationRequestStatus, updatedAt: Date.now() }
      : request,
  );
  await writeJson(CONSULTATION_REQUESTS_KEY, next);
  if (request) {
    await openThread({
      requestId: request.id,
      patientId: request.patientId,
      patientName: request.patientName,
      providerId: doctorId,
      providerName: doctorName,
    });
  }
  return next;
}
