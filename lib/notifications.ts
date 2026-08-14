/**
 * نظام الإشعارات الفورية (المشترك بين تطبيق المريض وتطبيق طبيب شريك ولوحة التحكم).
 *
 * في هذه المرحلة يُخزن في التخزين المحلي عبر مفتاح مشترك:
 * notifications_v1
 *
 * المتلقون (role):
 * - patient: إشعارات المريض (قبول/رفض طلبه، رسالة جديدة، تأكيد، استشارة)
 * - provider: إشعارات الشريك (طلب جديد، رسالة جديدة، إتمام خدمة، إشعار مستحقات)
 * - admin: إشعارات الإدارة داخل لوحة التحكم (شريك جديد بانتظار الموافقة، طلب جديد...)
 * - marketing: الإشعارات الدعائية التسويقية العامة التي ترسلها الإدارة للمرضى
 *
 * قنوات التبديل (channel) التي تتحكم بها لوحة التحكم يدويًا:
 * - patient_request: إشعارات المريض المتعلقة بالطلبات
 * - provider_alert: إشعارات الشريك المتعلقة بالطلبات
 * - done: إشعارات «تم» (تأكيد الدفع، إتمام الخدمة، تأكيد الموعد)
 * - promo: الإشعارات الدعائية التسويقية
 * - admin: إشعارات الإدارة
 *
 * عند توصيل خادم لاحقًا ينتقل التخزين إلى الخادم دون تغيير الواجهة.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export type NotificationType =
  | "request_received"
  | "request_accepted"
  | "request_rejected"
  | "chat_message"
  | "received_rating"
  | "payment_confirmed"
  | "earned_wallet_entry"
  | "consultation_started"
  | "request_completed"
  | "done" // إشعار «تم»: تأكيد الدفع/إتمام الخدمة/تأكيد الموعد
  | "promo" // إشعار دعائي تسويقي
  | "pending_provider" // حساب شريك جديد بانتظار موافقة الإدارة
  | "new_request"; // طلب جديد للإدارة

export type NotificationRole = "patient" | "provider" | "admin" | "marketing";

export type NotificationChannel = "patient_request" | "provider_alert" | "done" | "promo" | "admin";

export type Notification = {
  id: string;
  createdAt: number;
  read: boolean;
  role: NotificationRole;
  /** معرّف الطرف الذي يتلقى الإشعار: patientId أو providerId أو "admin" أو "patients" */
  recipientId: string;
  type: NotificationType;
  /** قناة التبديل التي يتحكم بها هذا الإشعار */
  channel: NotificationChannel;
  title: string;
  body: string;
  /** requestId المرتبط، إن وجد */
  requestId?: string;
  /** معرّف الطرف الآخر (مقدم الخدمة عند المريض والعكس) */
  otherPartyName?: string;
};

export const NOTIFICATIONS_KEY = "notifications_v1";

/** إعدادات قنوات الإشعارات (تشغيل/إيقاف يدوي من لوحة التحكم). */
export type NotificationRules = {
  enabled: boolean;
};

export type NotificationRulesMap = Record<NotificationChannel, NotificationRules>;

export const NOTIFICATION_RULES_KEY = "notification_rules_v1";

export const DEFAULT_NOTIFICATION_RULES: NotificationRulesMap = {
  patient_request: { enabled: true },
  provider_alert: { enabled: true },
  done: { enabled: true },
  promo: { enabled: true },
  admin: { enabled: true },
};

function genId(): string {
  return `notif_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** قراءة جميع الإشعارات من التخزين المحلي */
export async function readNotifications(): Promise<Notification[]> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is Notification => {
      return (
        !!item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.recipientId === "string" &&
        typeof item.role === "string" &&
        typeof item.type === "string" &&
        typeof item.title === "string" &&
        typeof item.body === "string"
      );
    });
  } catch {
    return [];
  }
}

/** قراءة إشعارات جهة محددة (مريض أو مقدم خدمة أو قناة تسويقية) */
export async function readRecipientNotifications(recipientId: string): Promise<Notification[]> {
  const all = await readNotifications();
  return all.filter((notification) => notification.recipientId === recipientId);
}

/** عدد الإشعارات غير المقروءة لجهة محددة */
export async function countUnreadNotifications(recipientId: string): Promise<number> {
  const notifications = await readRecipientNotifications(recipientId);
  return notifications.filter((notification) => !notification.read).length;
}

/** هل القناة مفعلة؟ الافتراض مفعلة إذا لم توجد إعدادات */
export async function isChannelEnabled(channel: NotificationChannel): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_RULES_KEY);
    if (!raw) return true;
    const rules = JSON.parse(raw) as Partial<NotificationRulesMap>;
    if (!rules || !rules[channel]) return true;
    return Boolean(rules[channel]?.enabled);
  } catch {
    return true;
  }
}

/** قراءة جميع قواعد قنوات الإشعارات (لللوحة) */
export async function readNotificationRules(): Promise<NotificationRulesMap> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_RULES_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_RULES };
    const rules = JSON.parse(raw) as Partial<NotificationRulesMap>;
    return {
      ...DEFAULT_NOTIFICATION_RULES,
      ...(rules ?? {}),
    };
  } catch {
    return { ...DEFAULT_NOTIFICATION_RULES };
  }
}

/** تبديل قناة إشعار (تشغيل/إيقاف) من لوحة التحكم */
export async function toggleNotificationChannel(channel: NotificationChannel): Promise<NotificationRulesMap> {
  const current = await readNotificationRules();
  const next: NotificationRulesMap = {
    ...current,
    [channel]: { enabled: !current[channel].enabled },
  };
  await AsyncStorage.setItem(NOTIFICATION_RULES_KEY, JSON.stringify(next));
  return next;
}

/** إضافة إشعار جديد غير مقروء، ويُحترم تبديل القناة */
export async function createNotification(input: {
  recipientId: string;
  role: NotificationRole;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  requestId?: string;
  otherPartyName?: string;
}): Promise<Notification | null> {
  if (!(await isChannelEnabled(input.channel))) return null;
  const notification: Notification = {
    ...input,
    id: genId(),
    createdAt: Date.now(),
    read: false,
  };
  const all = await readNotifications();
  await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([...all, notification]));
  return notification;
}

/** تعليم إشعار محدد كمقروء */
export async function markNotificationRead(notificationId: string): Promise<Notification | null> {
  const all = await readNotifications();
  const index = all.findIndex((notification) => notification.id === notificationId);
  if (index === -1) return null;
  const updated: Notification = { ...all[index], read: true };
  all[index] = updated;
  await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(all));
  return updated;
}

/** تعليم جميع إشعارات جهة محددة كمقروءة */
export async function markAllNotificationsRead(recipientId: string): Promise<void> {
  const all = await readNotifications();
  let changed = false;
  for (const notification of all) {
    if (notification.recipientId === recipientId && !notification.read) {
      notification.read = true;
      changed = true;
    }
  }
  if (changed) {
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(all));
  }
}

/** حذف إشعار محدد */
export async function deleteNotification(notificationId: string): Promise<void> {
  const all = await readNotifications();
  await AsyncStorage.setItem(
    NOTIFICATIONS_KEY,
    JSON.stringify(all.filter((notification) => notification.id !== notificationId)),
  );
}

/** إزالة إشعارات طلب معين (عند إعادة طلب أو تنظيف تلقائي) */
export async function deleteRequestNotifications(requestId: string): Promise<void> {
  const all = await readNotifications();
  await AsyncStorage.setItem(
    NOTIFICATIONS_KEY,
    JSON.stringify(all.filter((notification) => notification.requestId !== requestId)),
  );
}
