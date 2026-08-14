import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import type { ProviderAccount } from "@/lib/provider-auth";
import {
  updateIncomingRequestStatus,
  readIncomingRequests,
  type IncomingServiceRequest,
} from "@/lib/incoming-requests";
import { openThread } from "@/lib/chat";
import {
  createNotification,
  type NotificationType,
} from "@/lib/notifications";
import { getSessionAccount } from "@/lib/provider-auth";
import {
  readConsultationRequests,
  completeConsultationRequest,
  notifyConsultationStarted,
  type ConsultationRequest,
} from "@/lib/consultation-requests";

const STATUS_META: Record<
  IncomingServiceRequest["status"],
  { label: string; color: string; bg: string }
> = {
  pending: { label: "في الانتظار", color: "#8A6D2F", bg: "#F3E9D2" },
  accepted: { label: "مقبول", color: "#6B7B3F", bg: "#E6EADC" },
  rejected: { label: "مرفوض", color: "#B55448", bg: "#F7E3E0" },
  completed: { label: "مكتمل", color: "#6B7B3F", bg: "#E6EADC" },
  cancelled: { label: "ملغي", color: "#8A8173", bg: "#EFEAE0" },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقدي",
  electronic: "إلكتروني",
};

const PAYMENT_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  awaiting_provider_acceptance: {
    label: "بانتظار قبولك للطلب",
    color: "#8A6D2F",
    bg: "#F3E9D2",
  },
  payment_pending: {
    label: "المريض يختار طريقة الدفع",
    color: "#8A6D2F",
    bg: "#F3E9D2",
  },
  confirmed: {
    label: "تم تأكيد الدفع",
    color: "#6B7B3F",
    bg: "#E6EADC",
  },
};

type RequestStatus = IncomingServiceRequest["status"];

function groupByStatus(requests: IncomingServiceRequest[]):
  Array<{ status: RequestStatus; items: IncomingServiceRequest[] }> {
  const map = new Map<RequestStatus, IncomingServiceRequest[]>();
  for (const request of requests) {
    const list = map.get(request.status) ?? [];
    list.push(request);
    map.set(request.status, list);
  }
  const statuses: RequestStatus[] = [
    "pending",
    "accepted",
    "completed",
    "rejected",
    "cancelled",
  ];
  return statuses
    .map((status) => ({
      status,
      items: (map.get(status) ?? []).sort(
        (first, second) => second.createdAt - first.createdAt,
      ),
    }))
    .filter((group) => group.items.length > 0);
}

const CONSULTATION_STATUS_META: Record<
  ConsultationRequest["status"],
  { label: string; color: string; bg: string }
> = {
  pending: { label: "في الانتظار", color: "#8A6D2F", bg: "#F3E9D2" },
  accepted: { label: "مقبولة", color: "#6B7B3F", bg: "#E6EADC" },
  rejected: { label: "مرفوضة", color: "#B55448", bg: "#F7E3E0" },
  completed: { label: "مكتملة", color: "#6B7B3F", bg: "#E6EADC" },
  cancelled: { label: "ملغية", color: "#8A8173", bg: "#EFEAE0" },
};

function formatScheduledAt(timestamp?: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

export default function RequestsScreen() {
  const [account, setAccount] = useState<ProviderAccount | null>(null);
  const [requests, setRequests] = useState<IncomingServiceRequest[]>([]);
  const [consultations, setConsultations] = useState<ConsultationRequest[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = () => {
    void getSessionAccount().then(async (current) => {
      setAccount(current);
      if (!current) {
        router.replace("/login" as never);
        return;
      }
      void readIncomingRequests(current.id).then(setRequests);
      // طلبات الاستشارات: الشريك هو الطبيب الذي طلب منه المريض الاستشارة.
      void readConsultationRequests().then((all) =>
        setConsultations(all.filter((request) => request.doctorId === current.id)),
      );
    });
  };

  useFocusEffect(useCallback(reload, []));
  useEffect(() => {
    reload();
  }, []);

  const respond = async (
    request: IncomingServiceRequest,
    status: IncomingServiceRequest["status"],
  ) => {
    if (busy || !account) return;
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setBusy(true);
    try {
      const updated = await updateIncomingRequestStatus(
        request.id,
        account.id,
        status,
      );
      if (!updated) {
        Alert.alert("تعذر تحديث الطلب", "جرّب مرة أخرى.");
        return;
      }
      if (status === "accepted") {
        await openThread({
          requestId: request.id,
          patientId: request.patientId,
          patientName: request.patientName,
          providerId: account.id,
          providerName: account.fullName,
        });
      }
      const notificationType: NotificationType =
        status === "accepted" ? "request_accepted" : "request_rejected";
      await createNotification({
        recipientId: request.patientId,
        role: "patient",
        type: notificationType,
        title:
          status === "accepted"
            ? "تم قبول طلبك"
            : "تم رفض طلبك",
        body:
          status === "accepted"
            ? `وافق ${account.fullName} على طلبك${request.services.length > 0 ? ": " : ". "}${request.services.map((item) => `${item.serviceName} (${item.price} د.ل)`).join("، ")}.${updated.paymentStatus === "payment_pending" ? " يمكنك الآن اختيار طريقة الدفع (نقدي أو إلكتروني) من شاشة الدفع." : ""}`
            : `رفض ${account.fullName} طلبك. يمكنك طلب مقدم خدمة آخر.`,
        requestId: request.id,
        otherPartyName: account.fullName,
      });
      await reload();
      if (status === "rejected" && Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmCompletion = async (request: IncomingServiceRequest) => {
    if (busy || !account) return;
    const confirm = () =>
      void respond(request, "completed").then(() => {
        if (Platform.OS !== "web") {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      });
    if (Platform.OS === "web") {
      confirm();
    } else {
      Alert.alert(
        "إتمام الخدمة",
        `هل أنهيت خدمة ${request.patientName}؟`,
        [
          { text: "إلغاء", style: "cancel" },
          { text: "نعم، أتممت", onPress: confirm },
        ],
      );
    }
  };

  const paymentMeta = (request: IncomingServiceRequest) => {
    if (request.paymentStatus === "confirmed") return PAYMENT_STATUS_META.confirmed;
    if (request.paymentMethod === "cash") {
      return request.paymentStatus === "payment_pending"
        ? PAYMENT_STATUS_META.payment_pending
        : { label: "نقدي (يُدفع بعد انتهاء الخدمة)", color: "#8A6D2F", bg: "#F3E9D2" };
    }
    if (request.paymentMethod === "electronic") {
      return {
        label: request.paymentStatus === "payment_pending"
          ? "إلكتروني (بانتظار الدفع)"
          : `إلكتروني (${request.paymentStatus === "awaiting_provider_acceptance" ? "بانتظار قبولك" : "في الانتظار"})`,
        color: "#8A6D2F",
        bg: "#F3E9D2",
      };
    }
    return PAYMENT_STATUS_META.awaiting_provider_acceptance;
  };

  const groups = groupByStatus(requests);
  const consultationGroups = groupConsultationsByStatus(consultations);
  const consultationStatuses: ConsultationRequest["status"][] = [
    "accepted",
    "pending",
    "completed",
    "rejected",
    "cancelled",
  ];
  function groupConsultationsByStatus(items: ConsultationRequest[]):
    Array<{ status: ConsultationRequest["status"]; items: ConsultationRequest[] }> {
    const map = new Map<ConsultationRequest["status"], ConsultationRequest[]>();
    for (const item of items) {
      const list = map.get(item.status) ?? [];
      list.push(item);
      map.set(item.status, list);
    }
    return consultationStatuses
      .map((status) => ({
        status,
        items: (map.get(status) ?? []).sort((first, second) => second.createdAt - first.createdAt),
      }))
      .filter((group) => group.items.length > 0);
  }

  const startConsultation = async (request: ConsultationRequest) => {
    if (busy || !account) return;
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setBusy(true);
    try {
      await notifyConsultationStarted(request, account.fullName);
      await reload();
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } finally {
      setBusy(false);
    }
  };

  const completeConsultation = async (request: ConsultationRequest) => {
    if (busy || !account) return;
    const confirm = async () => {
      setBusy(true);
      try {
        await completeConsultationRequest(request.id);
        await createNotification({
          recipientId: request.patientId,
          role: "patient",
          type: "request_completed",
          requestId: request.id,
          otherPartyName: account.fullName,
          title: "اكتملت الاستشارة",
          body: `أنهى الطبيب ${account.fullName} جلسة الاستشارة. يمكنك الآن تقييم مقدم الخدمة.`,
        });
        await reload();
        if (Platform.OS !== "web") {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } finally {
        setBusy(false);
      }
    };
    if (Platform.OS === "web") {
      void confirm();
    } else {
      Alert.alert(
        "إتمام الاستشارة",
        `هل أنهيت جلسة الاستشارة مع ${request.patientName}؟`,
        [
          { text: "إلغاء", style: "cancel" },
          { text: "نعم، أتممت", onPress: () => void confirm() },
        ],
      );
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 32 }}>
        <View className="gap-2 mt-2 mb-4">
          <Text className="text-2xl font-bold text-foreground">الطلبات الواردة</Text>
          <Text className="text-sm text-muted leading-6">
            الطلبات التي يصلك إشعار بها عند حجز مريض لخدمتك.
          </Text>
        </View>

        {groups.length === 0 && (
          <View className="items-center rounded-2xl border border-border bg-surface p-8 gap-3">
            <Text className="text-base font-semibold text-foreground">لا توجد طلبات بعد</Text>
            <Text className="text-sm text-muted text-center leading-6">
              ستظهر هنا طلبات المرضى بمجرد تفعيل حسابك من الإدارة.
            </Text>
          </View>
        )}

        {groups.map((group) => {
          const meta = STATUS_META[group.status];
          return (
            <View key={group.status} className="mt-4 gap-2">
              <View className="flex-row items-center gap-2">
                <Text className="text-base font-bold text-foreground">{meta.label}</Text>
                <View style={[styles.countBadge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.countText, { color: meta.color }]}>
                    {group.items.length}
                  </Text>
                </View>
              </View>
              {group.items.map((request) => {
                const payMeta = paymentMeta(request);
                const canAct = group.status === "pending";
                return (
                  <View key={request.id} className="rounded-2xl border border-border bg-surface p-4 gap-2">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-base font-semibold text-foreground flex-1">
                        {request.patientName}
                      </Text>
                      <View style={[styles.statusChip, { backgroundColor: meta.bg }]}>
                        <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    </View>
                    <Text className="text-xs text-muted">{request.specialtyLabel}</Text>
                    <Text className="text-sm text-muted leading-5">
                      العنوان: {request.addressLabel}
                      {request.addressDetails ? ` — ${request.addressDetails}` : ""}
                    </Text>
                    <View className="gap-1">
                      {request.services.map((service) => (
                        <View key={service.serviceId} className="flex-row items-center justify-between">
                          <Text className="text-sm text-foreground flex-1">
                            {service.serviceName}
                            {service.durationMinutes ? ` · ${service.durationMinutes} دقيقة` : ""}
                          </Text>
                          <Text style={styles.priceText}>{service.price} د.ل</Text>
                        </View>
                      ))}
                      <View className="flex-row items-center justify-between border-t border-border pt-2 mt-1">
                        <Text className="text-sm font-bold text-foreground">الإجمالي</Text>
                        <Text style={styles.totalText}>{request.total} د.ل</Text>
                      </View>
                    </View>
                    {request.notes ? (
                      <Text className="text-sm text-muted leading-5">ملاحظة المريض: {request.notes}</Text>
                    ) : null}
                    {request.providerNotes ? (
                      <Text className="text-sm leading-5" style={styles.providerNoteText}>
                        ملاحظتك: {request.providerNotes}
                      </Text>
                    ) : null}
                    <View style={[styles.payChip, { backgroundColor: payMeta.bg }]}>
                      <Text style={[styles.payText, { color: payMeta.color }]}>
                        الدفع: {request.paymentMethod ? `${PAYMENT_METHOD_LABELS[request.paymentMethod] ?? request.paymentMethod} — ` : ""}{payMeta.label}
                      </Text>
                    </View>
                    {canAct && (
                      <View className="flex-row gap-2 mt-1">
                        <Pressable
                          onPress={() => void respond(request, "accepted")}
                          disabled={busy}
                          style={({ pressed }) => [
                            styles.acceptButton,
                            pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
                            busy && { opacity: 0.6 },
                          ]}
                        >
                          <Text style={styles.acceptText}>قبول</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => void respond(request, "rejected")}
                          disabled={busy}
                          style={({ pressed }) => [
                            styles.rejectButton,
                            pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
                            busy && { opacity: 0.6 },
                          ]}
                        >
                          <Text style={styles.rejectText}>رفض</Text>
                        </Pressable>
                      </View>
                    )}
                    {group.status === "accepted" && request.paymentStatus !== "confirmed" && (
                      <Text style={styles.waitText}>
                        في انتظار تأكيد الدفع من المريض قبل التوجه للخدمة...
                      </Text>
                    )}
                    {(group.status === "accepted" || group.status === "pending" && request.paymentStatus === "confirmed") && (
                      <View className="flex-row gap-2">
                        <Pressable
                          onPress={() =>
                            router.push({ pathname: "/chat", params: { id: request.id } } as never)
                          }
                          style={({ pressed }) => [
                            styles.chatButton,
                            pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
                          ]}
                        >
                          <Text style={styles.chatText}>الدردشة مع المريض</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => void confirmCompletion(request)}
                          disabled={busy}
                          style={({ pressed }) => [
                            styles.completeButton,
                            pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
                            busy && { opacity: 0.6 },
                          ]}
                        >
                          <Text style={styles.completeText}>أتممت الخدمة</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}
        {consultations.length > 0 && (
          <View className="mt-8 gap-2">
            <View className="flex-row items-center gap-2">
              <Text className="text-2xl font-bold text-foreground">الاستشارات</Text>
              <Text className="text-xs text-muted leading-5">
                طلبات الاستشارة المحجوزة معك مباشرة (داخل ليبيا وخارجها).
              </Text>
            </View>
            {consultationGroups.map((group) => {
              const meta = CONSULTATION_STATUS_META[group.status];
              return (
                <View key={`consultation-${group.status}`} className="mt-3 gap-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-bold text-foreground">{meta.label}</Text>
                    <View style={[styles.countBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.countText, { color: meta.color }]}>
                        {group.items.length}
                      </Text>
                    </View>
                  </View>
                  {group.items.map((request) => (
                    <View key={request.id} className="rounded-2xl border border-border bg-surface p-4 gap-2">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-base font-semibold text-foreground flex-1">
                          {request.patientName}
                          {request.externalDoctorName ? ` (${request.externalDoctorName})` : ""}
                        </Text>
                        <View style={[styles.statusChip, { backgroundColor: meta.bg }]}>
                          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                        </View>
                      </View>
                      <Text className="text-xs text-muted">{request.specialtyLabel}</Text>
                      {request.scheduledAt ? (
                        <Text className="text-xs text-muted">
                          الموعد: {formatScheduledAt(request.scheduledAt)}
                        </Text>
                      ) : (
                        <Text className="text-xs text-muted">استشارة فورية</Text>
                      )}
                      <View style={[styles.payChip, { backgroundColor: "#E6EADC" }]}>
                        <Text style={[styles.payText, { color: "#6B7B3F" }]}>
                          {request.mode === "scheduled" ? "حجز موعد" : "طلب فوري"} —
                          {request.paymentStatus === "confirmed"
                            ? " مدفوعة إلكترونيًا"
                            : " بانتظار الدفع"}
                          {" "}— {request.price} د.ل
                        </Text>
                      </View>
                      <View className="flex-row gap-2">
                        <Pressable
                          onPress={() =>
                            router.push({ pathname: "/chat", params: { id: request.id } } as never)
                          }
                          style={({ pressed }) => [
                            styles.chatButton,
                            pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
                          ]}
                        >
                          <Text style={styles.chatText}>الدردشة</Text>
                        </Pressable>
                        {group.status === "accepted" && (
                          <Pressable
                            onPress={() => void startConsultation(request)}
                            disabled={busy}
                            style={({ pressed }) => [
                              styles.acceptButton,
                              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
                              busy && { opacity: 0.6 },
                            ]}
                          >
                            <Text style={styles.acceptText}>بدء الاستشارة</Text>
                          </Pressable>
                        )}
                        {group.status === "accepted" && (
                          <Pressable
                            onPress={() => void completeConsultation(request)}
                            disabled={busy}
                            style={({ pressed }) => [
                              styles.completeButton,
                              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
                              busy && { opacity: 0.6 },
                            ]}
                          >
                            <Text style={styles.completeText}>إتمام الاستشارة</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  statusChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontWeight: "700" },
  countBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { fontSize: 11, fontWeight: "800" },
  priceText: { color: "#6B7B3F", fontSize: 13, fontWeight: "700" },
  totalText: { color: "#6B7B3F", fontSize: 15, fontWeight: "800" },
  providerNoteText: { color: "#6B7B3F" },
  payChip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  payText: { fontSize: 11, fontWeight: "700", lineHeight: 16 },
  waitText: { color: "#8A6D2F", fontSize: 11, lineHeight: 16 },
  acceptButton: {
    alignItems: "center",
    backgroundColor: "#6B7B3F",
    borderRadius: 999,
    flex: 1,
    paddingVertical: 11,
  },
  acceptText: { color: "#FFFDF8", fontSize: 14, fontWeight: "800" },
  rejectButton: {
    alignItems: "center",
    backgroundColor: "#FFFDF8",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#B55448",
    flex: 1,
    paddingVertical: 11,
  },
  rejectText: { color: "#B55448", fontSize: 14, fontWeight: "800" },
  chatButton: {
    alignItems: "center",
    backgroundColor: "#F3E9D2",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#C9A961",
    flex: 1,
    paddingVertical: 10,
  },
  chatText: { color: "#8A6D2F", fontSize: 13, fontWeight: "800" },
  completeButton: {
    alignItems: "center",
    backgroundColor: "#C9A961",
    borderRadius: 999,
    flex: 1,
    paddingVertical: 10,
  },
  completeText: { color: "#FFFDF8", fontSize: 13, fontWeight: "800" },
});
