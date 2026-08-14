import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import {
  AttachmentPickerButton,
  AttachmentPreview,
  MessageAttachmentCard,
} from "@/components/chat-attachment-bar";
import { findThread, readMessages, sendAttachmentMessage, sendMessage, type ChatAttachment, type ChatMessage } from "@/lib/chat";
import {
  readConsultationRequest,
  type ConsultationRequest,
} from "@/lib/consultation-requests";
import type { ProviderAccount } from "@/lib/provider-auth";
import {
  readIncomingRequests,
  type IncomingServiceRequest,
} from "@/lib/incoming-requests";
import { getSessionAccount } from "@/lib/provider-auth";

function useInterval(callback: () => void, intervalMs: number) {
  useEffect(() => {
    const timer = setInterval(callback, intervalMs);
    return () => clearInterval(timer);
  }, [callback, intervalMs]);
}

export default function ChatScreen() {
  const { id: requestId } = useLocalSearchParams<{ id: string }>();
  const [account, setAccount] = useState<ProviderAccount | null>(null);
  const [thread, setThread] = useState<{ threadId: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<IncomingServiceRequest | null>(null);
  const [consultation, setConsultation] = useState<ConsultationRequest | null>(null);

  const refresh = useCallback(async () => {
    if (!requestId) return;
    const found = await findThread(requestId);
    if (!found) {
      setError("المحادثة غير موجودة. يجب قبول الطلب أولًا.");
      return;
    }
    setThread(found as never);
    const loaded = await readMessages(found.threadId);
    setMessages(loaded);
  }, [requestId]);

  useEffect(() => {
    if (!requestId) {
      setError("معرف المحادثة غير متوفر.");
      return;
    }
    void getSessionAccount().then((current) => {
      setAccount(current);
      void refresh();
      void readIncomingRequests(current?.id ?? "").then(async (list) => {
        const match = list.find((item) => item.id === requestId);
        setRequest(match ?? null);
        if (!match) {
          // قد يكون المعرف لطلب استشارة وليس طلب خدمة منزلية.
          const consultationRequest = await readConsultationRequest(requestId);
          setConsultation(consultationRequest);
        }
      });
    });
  }, [requestId, refresh]);

  useInterval(refresh, 4000);

  const handleSend = async () => {
    if (sending || !thread || !account) return;
    if (pendingAttachment) {
      setSending(true);
      const currentText = input;
      setInput("");
      try {
        const message = await sendAttachmentMessage(thread.threadId, "provider", pendingAttachment, currentText);
        if (!message) {
          setError("تعذر إرسال المرفق.");
          return;
        }
        setPendingAttachment(null);
        setMessages((current) => [...current, message]);
        if (Platform.OS !== "web") {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } finally {
        setSending(false);
      }
      return;
    }
    const text = input.trim();
    if (!text) return;
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSending(true);
    setInput("");
    try {
      const message = await sendMessage(thread.threadId, "provider", text);
      if (!message) {
        setError("تعذر إرسال الرسالة.");
        return;
      }
      setMessages((current) => [...current, message]);
    } finally {
      setSending(false);
    }
  };

  const handleAttachmentPicked = (attachment: ChatAttachment) => {
    setPendingAttachment(attachment);
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const paymentHint = (current: IncomingServiceRequest | null) => {
    if (!current) return null;
    if (current.status !== "accepted") return "المحادثة متاحة بعد قبول الطلب.";
    if (current.paymentStatus === "confirmed") return "تم تأكيد الدفع — يمكنك التوجه للخدمة.";
    if (current.paymentMethod === "electronic") {
      return "بانتظار اكتمال الدفع الإلكتروني من المريض.";
    }
    if (current.paymentMethod === "cash") {
      return "الدفع نقدي — يُستلم عند إنهاء الخدمة.";
    }
    return "طريقة الدفع قيد الاختيار من المريض.";
  };

  const consultationHint = (): string | null => {
    if (!consultation) return null;
    if (consultation.status !== "accepted") return "المحادثة متاحة بعد قبول الاستشارة.";
    if (consultation.paymentStatus === "confirmed") return "تم تأكيد الدفع الإلكتروني — يمكنك بدء الاستشارة.";
    return "بانتظار اكتمال الدفع الإلكتروني من المريض.";
  };

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <View className="flex-row items-center gap-2 px-4 py-3 border-b border-border bg-surface">
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [{ padding: 6 }, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.backText}>← رجوع</Text>
          </Pressable>
          <View className="flex-1">
            <Text className="text-base font-bold text-foreground">
              {request?.patientName ?? consultation?.patientName ?? "محادثة"}
            </Text>
            {request && (
              <Text className="text-xs text-muted">{request.specialtyLabel}</Text>
            )}
            {consultation && (
              <Text className="text-xs text-muted">
                استشارة — {consultation.specialtyLabel}
                {consultation.scheduledAt
                  ? ` (${new Date(consultation.scheduledAt).toLocaleString("ar-LY")})`
                  : " (فورية)"}
              </Text>
            )}
          </View>
        </View>

        {consultationHint() ? (
          <View style={styles.hintBar}>
            <Text style={styles.hintText}>{consultationHint()}</Text>
          </View>
        ) : paymentHint(request) ? (
          <View style={styles.hintBar}>
            <Text style={styles.hintText}>{paymentHint(request)}</Text>
          </View>
        ) : null}

        {error ? (
          <View className="items-center justify-center flex-1 gap-2 px-6">
            <Text className="text-sm text-muted text-center">{error}</Text>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.retryText}>العودة للطلبات</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={messages}
            inverted
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            renderItem={({ item }) => {
              const isProvider = item.senderRole === "provider";
              if (!item.attachment && !item.text) return null;
              return (
                <View
                  style={[
                    styles.bubbleWrapper,
                    isProvider && styles.bubbleWrapperLeft,
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      isProvider ? styles.bubbleProvider : styles.bubblePatient,
                    ]}
                  >
                    {item.attachment ? (
                      <MessageAttachmentCard attachment={item.attachment} />
                    ) : null}
                    {item.text ? (
                      <Text
                        style={[
                          styles.bubbleText,
                          isProvider && styles.bubbleTextProvider,
                        ]}
                      >
                        {item.text}
                      </Text>
                    ) : null}
                    <Text
                      style={[
                        styles.bubbleTime,
                        isProvider && styles.bubbleTimeProvider,
                      ]}
                    >
                      {new Date(item.createdAt).toLocaleTimeString("ar-LY", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {pendingAttachment ? (
          <AttachmentPreview attachment={pendingAttachment} onRemove={() => setPendingAttachment(null)} />
        ) : null}

        <View className="flex-row items-center gap-2 px-4 py-2 border-t border-border bg-surface">
          <AttachmentPickerButton onPicked={handleAttachmentPicked} />
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={pendingAttachment ? "أضف وصفًا اختياريًا (اختياري)..." : "اكتب رسالة..."}
            placeholderTextColor="#8A8173"
            textAlign="right"
            className="flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-foreground"
            style={styles.inputText}
          />
          <Pressable
            onPress={handleSend}
            disabled={sending || (!input.trim() && !pendingAttachment)}
            style={({ pressed }) => [
              styles.sendButton,
              (sending || (!input.trim() && !pendingAttachment)) && styles.sendButtonDisabled,
              pressed && { transform: [{ scale: 0.95 }], opacity: 0.9 },
            ]}
          >
            <Text style={styles.sendText}>{sending ? "..." : "إرسال"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backText: { color: "#6B7B3F", fontSize: 15, fontWeight: "700" },
  hintBar: {
    backgroundColor: "#F3E9D2",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#C9A961",
  },
  hintText: { color: "#8A6D2F", fontSize: 11, lineHeight: 16 },
  retryButton: {
    backgroundColor: "#6B7B3F",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { color: "#FFFDF8", fontSize: 13, fontWeight: "800" },
  bubbleWrapper: { flexDirection: "row", justifyContent: "flex-end" },
  bubbleWrapperLeft: { justifyContent: "flex-start" },
  bubble: {
    borderRadius: 16,
    maxWidth: "78%",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleProvider: {
    backgroundColor: "#6B7B3F",
    borderBottomEndRadius: 4,
  },
  bubblePatient: {
    backgroundColor: "#FFFDF8",
    borderWidth: 1,
    borderColor: "#E4DCCB",
    borderBottomStartRadius: 4,
  },
  bubbleText: { color: "#1F2414", fontSize: 14, lineHeight: 20 },
  bubbleTextProvider: { color: "#FFFDF8" },
  bubbleTime: { color: "#A89F8C", fontSize: 9, marginTop: 2 },
  bubbleTimeProvider: { color: "#D8DDC6" },
  inputText: { fontSize: 14, lineHeight: 20 },
  sendButton: {
    alignItems: "center",
    backgroundColor: "#6B7B3F",
    borderRadius: 999,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButtonDisabled: { backgroundColor: "#C4CBAB" },
  sendText: { color: "#FFFDF8", fontSize: 13, fontWeight: "800" },
});
