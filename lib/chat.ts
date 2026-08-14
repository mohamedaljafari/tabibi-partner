/**
 * نظام الدردشة الداخلي (مشترك بين تطبيق المريض وتطبيق طبيب شريك).
 *
 * في هذه المرحلة يُخزن في التخزين المحلي عبر مفتاح مشترك:
 * provider_chats_v1
 *
 * القواعد:
 * - لا تظهر الدردشة إلا بعد قبول مقدم الخدمة للطلب (requestId مقبول فقط).
 * - كل طلب مقبول له "محادثة" واحدة تربط المريض بمقدم الخدمة.
 * - عند توصيل خادم لاحقًا ينتقل التخزين إلى الخادم دون تغيير الواجهة.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ChatAttachment = {
  /** "image" أو "file" (PDF وغيرها) */
  kind: "image" | "file";
  fileName: string;
  /** نوع الملف مثل image/jpeg أو application/pdf */
  mimeType: string;
  /** مسار الملف المحلي على الجهاز */
  uri: string;
};

export type ChatMessage = {
  id: string;
  threadId: string;
  /** "patient" أو "provider" */
  senderRole: "patient" | "provider";
  text: string;
  /** مرفق (صورة أو تقرير طبي PDF) إن وجد */
  attachment?: ChatAttachment;
  createdAt: number;
};

export type ChatThread = {
  /** threadId = requestId نفسه لتبسيط المطابقة */
  threadId: string;
  requestId: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  createdAt: number;
};

export const CHAT_THREADS_KEY = "provider_chat_threads_v1";
export const CHAT_MESSAGES_KEY = "provider_chat_messages_v1";

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readJson<T>(key: string, isList: boolean): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return isList ? ([] as T) : ({} as T);
    const parsed = JSON.parse(raw);
    return isList && Array.isArray(parsed) ? (parsed as T) : parsed;
  } catch {
    return isList ? ([] as T) : ({} as T);
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

/** إيجاد المحادثة المرتبطة بطلب معين (أيًا كان من يتصل) */
export async function findThread(requestId: string): Promise<ChatThread | null> {
  const threads = await readJson<ChatThread[]>(CHAT_THREADS_KEY, true);
  return threads.find((thread) => thread.requestId === requestId) ?? null;
}

/** محادثات مريض معين (الطلبات المقبولة) */
export async function readPatientThreads(patientId: string): Promise<ChatThread[]> {
  const threads = await readJson<ChatThread[]>(CHAT_THREADS_KEY, true);
  return threads
    .filter((thread) => thread.patientId === patientId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** محادثات مقدم خدمة معين */
export async function readProviderThreads(providerId: string): Promise<ChatThread[]> {
  const threads = await readJson<ChatThread[]>(CHAT_THREADS_KEY, true);
  return threads
    .filter((thread) => thread.providerId === providerId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** إنشاء محادثة جديدة عند قبول الطلب */
export async function openThread(input: {
  requestId: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
}): Promise<ChatThread> {
  const existing = await findThread(input.requestId);
  if (existing) return existing;
  const thread: ChatThread = {
    threadId: input.requestId,
    requestId: input.requestId,
    patientId: input.patientId,
    patientName: input.patientName,
    providerId: input.providerId,
    providerName: input.providerName,
    createdAt: Date.now(),
  };
  const threads = await readJson<ChatThread[]>(CHAT_THREADS_KEY, true);
  await writeJson(CHAT_THREADS_KEY, [...threads, thread]);
  return thread;
}

/** حذف محادثة عند إلغاء الطلب */
export async function removeThread(requestId: string): Promise<void> {
  const threads = await readJson<ChatThread[]>(CHAT_THREADS_KEY, true);
  const filtered = threads.filter((thread) => thread.requestId !== requestId);
  await writeJson(CHAT_THREADS_KEY, filtered);
  const messages = await readJson<ChatMessage[]>(CHAT_MESSAGES_KEY, true);
  await writeJson(
    CHAT_MESSAGES_KEY,
    messages.filter((message) => message.threadId !== requestId),
  );
}

/** رسائل محادثة معينة */
export async function readMessages(threadId: string): Promise<ChatMessage[]> {
  const messages = await readJson<ChatMessage[]>(CHAT_MESSAGES_KEY, true);
  return messages
    .filter((message) => message.threadId === threadId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** إرسال رسالة (نصية) في محادثة */
export async function sendMessage(
  threadId: string,
  senderRole: "patient" | "provider",
  text: string,
): Promise<ChatMessage | null> {
  const thread = await findThread(threadId);
  if (!thread) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const message: ChatMessage = {
    id: genId("msg"),
    threadId,
    senderRole,
    text: trimmed,
    createdAt: Date.now(),
  };
  const messages = await readJson<ChatMessage[]>(CHAT_MESSAGES_KEY, true);
  await writeJson(CHAT_MESSAGES_KEY, [...messages, message]);
  return message;
}

/** إرسال رسالة مرفق (صورة أو تقرير طبي) مع نص اختياري في محادثة */
export async function sendAttachmentMessage(
  threadId: string,
  senderRole: "patient" | "provider",
  attachment: ChatAttachment,
  text?: string,
): Promise<ChatMessage | null> {
  const thread = await findThread(threadId);
  if (!thread) return null;
  if (!attachment.uri) return null;
  const message: ChatMessage = {
    id: genId("msg"),
    threadId,
    senderRole,
    text: (text ?? "").trim(),
    attachment,
    createdAt: Date.now(),
  };
  const messages = await readJson<ChatMessage[]>(CHAT_MESSAGES_KEY, true);
  await writeJson(CHAT_MESSAGES_KEY, [...messages, message]);
  return message;
}

/** عدد الرسائل غير المقروءة لمستخدم معين عبر محادثاته (بآخر قراءة) */
export async function countUnreadMessages(
  threadId: string,
  myRole: "patient" | "provider",
): Promise<number> {
  const messages = await readMessages(threadId);
  return messages.filter((message) => message.senderRole !== myRole).length;
}
