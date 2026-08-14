/**
 * نظام الإشعارات الفورية (المشترك بين تطبيق المريض وتطبيق طبيب شريك).
 *
 * في هذه المرحلة يُخزن في التخزين المحلي عبر مفتاح مشترك:
 * notifications_v1
 *
 * أنواع الإشعارات:
 * - للمريض: قبول أو رفض طلبه، أو رسالة جديدة من مقدم الخدمة
 * - لمقدم الخدمة: طلب جديد من مريض، أو رسالة جديدة من مريض
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
  | "earned_wallet_entry";

export type NotificationRole = "patient" | "provider";

export type Notification = {
  id: string;
  createdAt: number;
  read: boolean;
  role: NotificationRole;
  /** معرّف الطرف الذي يتلقى الإشعار: patientId أو providerId */
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** requestId المرتبط، إن وجد */
  requestId?: string;
  /** معرّف الطرف الآخر (مقدم الخدمة عند المريض والعكس) */
  otherPartyName?: string;
};

export const NOTIFICATIONS_KEY = "notifications_v1";

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

/** قراءة إشعارات جهة محددة (مريض أو مقدم خدمة) */
export async function readRecipientNotifications(recipientId: string): Promise<Notification[]> {
  const all = await readNotifications();
  return all.filter((notification) => notification.recipientId === recipientId);
}

/** عدد الإشعارات غير المقروءة لجهة محددة */
export async function countUnreadNotifications(recipientId: string): Promise<number> {
  const notifications = await readRecipientNotifications(recipientId);
  return notifications.filter((notification) => !notification.read).length;
}

/** إضافة إشعار جديد غير مقروء */
export async function createNotification(input: {
  recipientId: string;
  role: NotificationRole;
  type: NotificationType;
  title: string;
  body: string;
  requestId?: string;
  otherPartyName?: string;
}): Promise<Notification> {
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

/** إزالة إشعارات طلب معين (عند إعادة طلب أو تنظف تلقائي) */
export async function deleteRequestNotifications(requestId: string): Promise<void> {
  const all = await readNotifications();
  await AsyncStorage.setItem(
    NOTIFICATIONS_KEY,
    JSON.stringify(all.filter((notification) => notification.requestId !== requestId)),
  );
}
