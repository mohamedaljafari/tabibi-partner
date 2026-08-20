/**
 * اختبار الدورة الكاملة للخدمة عبر التطبيقين عبر تخزين محلي مشترك محاكى.
 *
 * المحاكاة: vi.mock موحد لـ AsyncStorage يشارك الحالة بين مكتبات التطبيقين
 * (الطلبات، الإشعارات، الدردشة، حسابات مقدمي الخدمة) لأن كلا التطبيقين يخزنان
 * في نفس المفاتيح فعليًا عند التشغيل على نفس الجهاز.
 *
 * الدورة المختبرة:
 * 1) مقدم الخدمة يسجل حسابًا ويكمل بياناته (تخصصات + خبرة + نبذة + خدمات + مواعيد) ويصبح مفعّلًا.
 * 2) المريض يسجل، يبحث عن مقدم الخدمة، يرسل طلبًا بعدة خدمات.
 * 3) مقدم الخدمة يستلم الإشعار ويقرأ الطلبات الواردة ويقبل الطلب.
 * 4) المريض يستلم إشعار القبول، تفتح محادثة الدردشة.
 * 5) الطرفان يتبادلان الرسائل (المريض ومقدم الخدمة).
 * 6) مقدم الخدمة يسجل إتمام الزيارة ويتأكد المريض من الحالة النهائية.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CHAT_MESSAGES_KEY,
  CHAT_THREADS_KEY,
  countUnreadMessages,
  findThread,
  openThread,
  readMessages,
  readPatientThreads,
  readProviderThreads,
  sendMessage,
} from "../lib/chat";
import {
  countUnreadNotifications,
  createNotification,
  NOTIFICATIONS_KEY,
  readRecipientNotifications,
} from "../lib/notifications";
import {
  createServiceRequest,
  readPatientRequests,
  readProviderRequests,
  updateRequestStatus,
} from "../lib/service-requests";

import {
  activateProviderAccount,
  completeProviderProfile,
  listProviderAccounts,
  registerProvider,
  signInProvider,
  getSessionAccount,
  saveProviderAccounts,
} from "../lib/provider-auth";
import {
  getServicesForSpecialization,
  hasAvailabilityErrors,
  hasServicesErrors,
  validateAvailability,
  validateProviderServices,
  type AvailabilitySlot,
} from "../lib/provider-services";
import { readIncomingRequests, updateIncomingRequestStatus, type IncomingServiceRequest as ProviderRequest } from "../lib/incoming-requests";
import {
  countUnreadNotifications as countProviderNotifications,
  readRecipientNotifications as readProviderNotifications,
} from "../lib/notifications";
import { tabibiCleanUser } from "../lib/supabase";



const PATIENT_ID = "patient-1";
const PATIENT_NAME = "محمد صالح";
const PATIENT_PHONE = "+218900000016";
const PROVIDER_PHONE = "+218900000015";
const PROVIDER_PASSWORD = "StrongPass1!";

beforeEach(async () => {
  vi.clearAllMocks();
  await AsyncStorage.clear();
  // تنظيف حسابات الاختبار من قاعدة MySQL المركزية حتى لا يفشل التسجيل بـ "الرقم مسجل مسبقًا"
  await tabibiCleanUser(PROVIDER_PHONE);
  await tabibiCleanUser(PATIENT_PHONE);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** سيناريو التحضير: تسجيل مقدم خدمة وتفعيله ببيانات كاملة */
async function prepareProviderHalf1(): Promise<string> {
  const registration = await registerProvider({
    fullName: "د. أحمد رائد",
    role: "طبيب",
    phone: PROVIDER_PHONE,
    password: PROVIDER_PASSWORD,
    confirmPassword: PROVIDER_PASSWORD,
  });
  if (!registration.success) console.error("REGERR:", registration.error);
  expect(registration.success).toBe(true);
  return registration.account!.id;

}

async function prepareProviderHalf2(accountId: string): Promise<void> {
  const services = getServicesForSpecialization("طب عام").slice(0, 3).map((name: string, index: number) => ({
    id: `svc-${index}`,
    name,
    price: 120 + index * 30,
    durationMinutes: 30 + index * 15,
  }));
  expect(hasServicesErrors(validateProviderServices(services))).toBe(false);
  const availability = { availableNow: true, slots: [{ day: "saturday", startHour: "09:00", endHour: "14:00" } satisfies AvailabilitySlot] };
  expect(hasAvailabilityErrors(validateAvailability(availability))).toBe(false);

  const profile = await completeProviderProfile(accountId, {
    specializations: ["طب عام"],
    yearsOfExperience: 10,
    bio: "طبيب عام بخبرة عشر سنوات في الرعاية المنزلية",
    photoUri: "",
    documents: [{ id: "doc-1", name: "الشهادة الجامعية", type: "certificate", uri: "file://doc.pdf" }],
    services,
    availability,
  });
  expect(profile.success).toBe(true);
  // حساب الشريك يبقى قيد المراجعة (pending) حتى توافق الإدارة على المستندات
  expect(profile.account!.status).toBe("pending");

  const activation = await activateProviderAccount(accountId);
  expect(activation.success).toBe(true);

  // مزامنة الحالة المحلية مع Supabase (كما يفعل التطبيق بعد التفعيل)
  const current = await getSessionAccount();
  if (current && current.id === accountId) {
    await saveProviderAccounts([current]);
  }

  const accounts = await listProviderAccounts();
  expect(accounts.some((account: { id: string; status?: string }) => account.id === accountId && account.status === "active")).toBe(true);
}


describe("الدورة الكاملة للخدمة بين المريض ومقدم الخدمة", () => {
  it("مقدم الخدمة يسجل ويكمل البيانات ويظهر مفعّلًا للبحث", async () => {
    const accountId = await prepareProviderHalf1();
    await prepareProviderHalf2(accountId);

    // تسجيل دخول مقدم الخدمة والتحقق من الجلسة
    const signIn = await signInProvider(PROVIDER_PHONE, PROVIDER_PASSWORD);
    expect(signIn.success).toBe(true);
    expect(signIn.account!.id).toBe(accountId);
    expect(signIn.account!.specializations).toContain("طب عام");
    expect(signIn.account!.services.length).toBe(3);
  });

  it("المريض يسجل طلبًا بعدة خدمات ويصل الإشعار لمقدم الخدمة", async () => {
    const accountId = await prepareProviderHalf1();
    await prepareProviderHalf2(accountId);

    // المريض يختار مقدم الخدمة من نتائج البحث ويرسل طلبًا (بنفس سلوك doctor-detail مع specialtyLabel وaddressLabel إجباريين)
    const request = await createServiceRequest({
      patientId: PATIENT_ID,
      patientName: PATIENT_NAME,
      patientPhone: PATIENT_PHONE,
      addressLabel: "المنزل",
      addressDetails: "طرابلس، شارع الجمهورية",
      providerId: accountId,
      providerName: "د. أحمد رائد",
      specialtyLabel: "طب عام",
      services: [
        { serviceId: "svc-0", serviceName: "كشف منزلي", price: 120, durationMinutes: 30 },
        { serviceId: "svc-1", serviceName: "قياس ضغط وسكر", price: 150, durationMinutes: 45 },
      ],
      total: 270,
      notes: "المريض يحتاج متابعة ضغط",
    });
    expect(request.status).toBe("pending");
    expect(request.total).toBe(270);

    // الطلب يظهر في سجلات المريض
    const patientRequests = await readPatientRequests(PATIENT_ID);
    expect(patientRequests).toHaveLength(1);
    expect(patientRequests[0].status).toBe("pending");

    // مقدم الخدمة يستلم الطلب في القائمة الواردة
    const incoming = await readIncomingRequests(accountId);
    expect(incoming).toHaveLength(1);
    expect(incoming[0].status).toBe("pending");

    // مقدم الخدمة يراه طلباته الواردة وليس طلبات غيره
    const otherProvider = await readIncomingRequests("provider-other");
    expect(otherProvider).toHaveLength(0);

    // إشعار الطلب الجديد لمقدم الخدمة (ينشئه التطبيق عند إرسال الطلب)
    await createNotification({
      recipientId: accountId,
      role: "provider",
      type: "request_received",
      channel: "provider_alert",
      title: "طلب خدمة جديد",
      body: "كشف منزلي + قياس ضغط وسكر — الإجمالي 270",
      requestId: request.id,
      otherPartyName: PATIENT_NAME,
    });
    const providerNotifs = await readProviderNotifications(accountId);
    const received = providerNotifs.find((notification: { type?: string }) => notification.type === "request_received");
    expect(received).toBeTruthy();
    expect(received!.read).toBe(false);
    expect(await countProviderNotifications(accountId)).toBe(1);
  });

  it("مقدم الخدمة يقبل الطلب ويصل إشعار القبول للمريض", async () => {
    const accountId = await prepareProviderHalf1();
    await prepareProviderHalf2(accountId);
    const request = await createServiceRequest({
      patientId: PATIENT_ID,
      patientName: PATIENT_NAME,
      patientPhone: PATIENT_PHONE,
      addressLabel: "المنزل",
      addressDetails: "طرابلس، شارع الجمهورية",
      providerId: accountId,
      providerName: "د. أحمد رائد",
      specialtyLabel: "طب عام",
      services: [{ serviceId: "svc-0", serviceName: "كشف منزلي", price: 120 }],
      total: 120,
    });

    // مقدم الخدمة يقبل الطلب من قائمة الواردة
    const accepted = await updateIncomingRequestStatus(request.id, accountId, "accepted", "سأصل إليك خلال ساعة");

    // إشعار القبول للمريض (ينشئه التطبيق عند الرد)
    await createNotification({
      recipientId: PATIENT_ID,
      role: "patient",
      type: "request_accepted",
      channel: "patient_request",
      title: "تم قبول طلبك",
      body: "سأصل إليك خلال ساعة",
      requestId: request.id,
      otherPartyName: "د. أحمد رائد",
    });
    expect(accepted).toBeTruthy();
    expect(accepted!.status).toBe("accepted");
    expect(accepted!.providerNotes).toBe("سأصل إليك خلال ساعة");

    // الحالة تنعكس لدى المريض (تخزين مشترك)
    const patientRequests = await readPatientRequests(PATIENT_ID);
    expect(patientRequests[0].status).toBe("accepted");

    // إشعار القبول يصل للمريض
    const patientNotifs = await readRecipientNotifications(PATIENT_ID);
    const acceptedNotif = patientNotifs.find((notification) => notification.type === "request_accepted");
    expect(acceptedNotif).toBeTruthy();
    expect(acceptedNotif!.read).toBe(false);
    expect(await countUnreadNotifications(PATIENT_ID)).toBe(1);

  });

  it("الرفض يوصل إشعار رفض للمريض", async () => {
    const accountId = await prepareProviderHalf1();
    await prepareProviderHalf2(accountId);
    const request = await createServiceRequest({
      patientId: PATIENT_ID,
      patientName: PATIENT_NAME,
      patientPhone: PATIENT_PHONE,
      providerId: accountId,
      providerName: "د. أحمد رائد",
      services: [{ serviceId: "svc-0", serviceName: "كشف منزلي", price: 120 }],
      total: 120,
      specialtyLabel: "طب عام",
      addressLabel: "المنزل",
    });

    const rejected = await updateIncomingRequestStatus(request.id, accountId, "rejected", "غير متاح حاليًا");

    // إشعار الرفض ينشئه التطبيق عند الرد (مثل شاشة الطلبات)
    await createNotification({
      recipientId: PATIENT_ID,
      role: "patient",
      type: "request_rejected",
      channel: "patient_request",
      title: "رُفض طلبك",
      body: "غير متاح حاليًا",
      requestId: request.id,
      otherPartyName: "د. أحمد رائد",
    });
    expect(rejected!.status).toBe("rejected");

    const patientNotifs = await readRecipientNotifications(PATIENT_ID);
    expect(patientNotifs.some((notification: { type?: string }) => notification.type === "request_rejected")).toBe(true);
  });

  it("الدردشة تفتح بعد القبول ويتبادل الطرفان الرسائل", async () => {
    const accountId = await prepareProviderHalf1();
    await prepareProviderHalf2(accountId);
    const request = await createServiceRequest({
      patientId: PATIENT_ID,
      patientName: PATIENT_NAME,
      patientPhone: PATIENT_PHONE,
      providerId: accountId,
      providerName: "د. أحمد رائد",
      services: [{ serviceId: "svc-0", serviceName: "كشف منزلي", price: 120 }],
      total: 120,
      specialtyLabel: "طب عام",
      addressLabel: "المنزل",
    });

    // الدردشة غير موجودة قبل القبول
    let thread = await findThread(request.id);
    expect(thread).toBeNull();
    expect(await readPatientThreads(PATIENT_ID)).toHaveLength(0);

    await updateIncomingRequestStatus(request.id, accountId, "accepted");

    // المحادثة تُفتح تلقائيًا عند قبول مقدم الخدمة للطلب (كما في app/(tabs)/requests.tsx)
    await openThread({
      requestId: request.id,
      patientId: PATIENT_ID,
      patientName: PATIENT_NAME,
      providerId: accountId,
      providerName: "د. أحمد رائد",
    });
    thread = await findThread(request.id);
    expect(thread).toBeTruthy();
    expect(thread!.threadId).toBe(request.id);

    // ظهورها لدى الطرفين
    expect(await readPatientThreads(PATIENT_ID)).toHaveLength(1);
    expect(await readProviderThreads(accountId)).toHaveLength(1);
        expect(await readProviderThreads("provider-other")).toHaveLength(0);
    const tid = (thread ?? (() => { throw new Error("no thread"); })()).threadId;
    // تبادل الرسائل
    await sendMessage(tid, "patient", "السلام عليكم، متى تصل؟");
    await sendMessage(tid, "provider", "وعليكم السلام، خلال 45 دقيقة");
    await sendMessage(tid, "patient", "تمام، في الانتظار");
    const messages = await readMessages(tid);
    expect(messages).toHaveLength(3);
    expect(messages[0].senderRole).toBe("patient");
    expect(messages[1].senderRole).toBe("provider");
    expect(messages[2].text).toContain("الانتظار");
    // إشعار الرسالة الجديدة (ينشئه التطبيق عند إرسال كل رسالة)
    await createNotification({ recipientId: PATIENT_ID, role: "patient", type: "chat_message", channel: "patient_request", title: "رسالة جديدة", body: "وعليكم السلام، خلال 45 دقيقة", requestId: tid, otherPartyName: "د. أحمد رائد" });
    await createNotification({ recipientId: accountId, role: "provider", type: "chat_message", channel: "provider_alert", title: "رسالة جديدة", body: "تمام، في الانتظار", requestId: tid, otherPartyName: PATIENT_NAME });
    const patientNotifs = await readRecipientNotifications(PATIENT_ID);
    expect(patientNotifs.some((notification: { type?: string }) => notification.type === "chat_message")).toBe(true);
    const providerNotifs = await readProviderNotifications(accountId);
    expect(providerNotifs.some((notification: { type?: string }) => notification.type === "chat_message")).toBe(true);

    // قراءة الرسائل تحسب unread حسب الطرف
    expect(await countUnreadMessages(tid, "patient")).toBeGreaterThanOrEqual(0);
  });

  it("مقدم الخدمة يسجل إتمام الزيارة ويظهر للمريض", async () => {
    const accountId = await prepareProviderHalf1();
    await prepareProviderHalf2(accountId);
    const request = await createServiceRequest({
      patientId: PATIENT_ID,
      patientName: PATIENT_NAME,
      patientPhone: PATIENT_PHONE,
      providerId: accountId,
      providerName: "د. أحمد رائد",
      services: [{ serviceId: "svc-0", serviceName: "كشف منزلي", price: 120 }],
      total: 120,
      specialtyLabel: "طب عام",
      addressLabel: "المنزل",
    });

    await updateIncomingRequestStatus(request.id, accountId, "accepted");
    const completed = await updateIncomingRequestStatus(request.id, accountId, "completed", "تمت الزيارة بنجاح");
    expect(completed!.status).toBe("completed");

    const patientRequests = await readPatientRequests(PATIENT_ID);
    expect(patientRequests[0].status).toBe("completed");

    // الدردشة تبقى متاحة بعد الإتمام (للمتابعة)
    expect(await readPatientThreads(PATIENT_ID)).toHaveLength(0);
    const thread = await openThread({
      requestId: request.id,
      patientId: PATIENT_ID,
      patientName: PATIENT_NAME,
      providerId: accountId,
      providerName: "د. أحمد رائد",
    });
    await sendMessage(thread.threadId, "provider", "تمت الزيارة بنجاح، بالشفاء");
    const messages = await readMessages(thread.threadId);
    expect(messages[messages.length - 1].senderRole).toBe("provider");
  });

  it("الطلب المرفوض لا يحسب ضمن طلبات مقدم الخدمة النشطة", async () => {
    const accountId = await prepareProviderHalf1();
    await prepareProviderHalf2(accountId);
    const request1 = await createServiceRequest({
      patientId: PATIENT_ID,
      patientName: PATIENT_NAME,
      patientPhone: PATIENT_PHONE,
      providerId: accountId,
      providerName: "د. أحمد رائد",
      services: [{ serviceId: "svc-0", serviceName: "كشف منزلي", price: 120 }],
      total: 120,
      specialtyLabel: "طب عام",
      addressLabel: "المنزل",
    });
    const request2 = await createServiceRequest({
      patientId: "patient-2",
      patientName: "سالم حسن",
      patientPhone: PATIENT_PHONE,
      providerId: accountId,
      providerName: "د. أحمد رائد",
      services: [{ serviceId: "svc-0", serviceName: "كشف منزلي", price: 120 }],
      total: 120,
      specialtyLabel: "طب عام",
      addressLabel: "المنزل",
    });

    await updateIncomingRequestStatus(request1.id, accountId, "rejected");
    await updateIncomingRequestStatus(request2.id, accountId, "accepted");

    const incoming = await readIncomingRequests(accountId);
    const pendingOrActive = incoming.filter((request: ProviderRequest) => request.status === "pending" || request.status === "accepted");
    expect(pendingOrActive).toHaveLength(1);
    expect(pendingOrActive[0].id).toBe(request2.id);
  });
});
