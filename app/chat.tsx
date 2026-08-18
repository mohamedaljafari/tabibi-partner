/**
 * شاشة الدردشة النصية في تطبيق طبيب شريك — واجهة مطوّرة (مطابقة لتطبيق المريض).
 *
 * لا تُفتح هذه الشاشة إلا بعد قبول الشريك للطلب (حالة accepted أو completed)،
 * وهي محادثة نصية بين الشريك والمريض المرتبطة بطلب الخدمة (threadId = requestId).
 *
 * الميزات:
 * - فقاعات رسائل أنظف مع تجميع الرسائل المتتالية وزوايا حادة للمرسِل.
 * - مؤشر «يكتب الآن...» يقرأ حالة الكتابة من المريض عبر مفتاح مشترك.
 * - الرد على رسالة معينة: ضغطة مطوّلة على رسالة المريض تظهر شريط رد مع اقتباس.
 * - مؤشر إرسال (قيد الإرسال/تم الإرسال) ومنع الإرسال المكرر.
 * - فتح الصور كاملة في نافذة داكنة عند الضغط عليها.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import {
  AttachmentPickerButton,
  AttachmentPreview,
  MessageAttachmentCard,
} from "@/components/chat-attachment-bar";
import {
  findThread,
  isOtherTyping,
  markTyping,
  readMessages,
  sendAttachmentMessage,
  sendMessage,
  type ChatAttachment,
  type ChatMessage,
} from "@/lib/chat";
import {
  readConsultationRequest,
  type ConsultationRequest,
} from "@/lib/consultation-requests";
import { getSessionAccount } from "@/lib/provider-auth";
import type { ProviderAccount } from "@/lib/provider-auth";
import {
  readIncomingRequests,
  type IncomingServiceRequest,
} from "@/lib/incoming-requests";

type OptimisticMessage = ChatMessage & { _optimistic: true };

export default function ChatScreen() {
  const { id: requestId } = useLocalSearchParams<{ id: string }>();
  const [account, setAccount] = useState<ProviderAccount | null>(null);
  const [thread, setThread] = useState<{ threadId: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [optimistic, setOptimistic] = useState<OptimisticMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<IncomingServiceRequest | null>(null);
  const [consultation, setConsultation] = useState<ConsultationRequest | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const listRef = useRef<FlatList<ChatMessage> | null>(null);
  const threadRef = useRef<string | null>(null);
  threadRef.current = thread?.threadId ?? null;

  const refresh = useCallback(async () => {
    const id = threadRef.current;
    if (!id) return;
    const loaded = await readMessages(id);
    setMessages(loaded);
    // إزالة الرسائل المؤجلة التي حُفظت فعلاً
    setOptimistic((current) =>
      current.filter((message) => !loaded.some((saved) => saved.id === message.id)),
    );
  }, []);

  useEffect(() => {
    if (!requestId) {
      setError("معرف المحادثة غير متوفر.");
      return;
    }
    let cancelled = false;
    const init = async () => {
      const found = await findThread(requestId);
      if (cancelled || !found) {
        if (!cancelled) setError("المحادثة غير موجودة. يجب قبول الطلب أولًا.");
        return;
      }
      setThread(found as never);
      const loaded = await readMessages(found.threadId);
      if (cancelled) return;
      setMessages(loaded);
      const current = await getSessionAccount();
      if (cancelled) return;
      setAccount(current);
      const list = await readIncomingRequests(current?.id ?? "");
      if (cancelled) return;
      const match = list.find((item) => item.id === requestId);
      setRequest(match ?? null);
      if (!match) {
        const consultationRequest = await readConsultationRequest(requestId);
        if (!cancelled) setConsultation(consultationRequest);
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  useEffect(() => {
    const interval = setInterval(() => {
      refresh();
    }, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  // مؤشر الكتابة: قراءة دورية لحالة المريض، وكتابة لحظة آخر حرف عند التغيير
  useEffect(() => {
    const id = thread?.threadId;
    if (!id) return;
    const check = () => {
      void isOtherTyping(id, "provider").then(setOtherTyping);
    };
    check();
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, [thread]);

  useEffect(() => {
    if (!input.trim() || !thread?.threadId) return;
    void markTyping(thread.threadId, "provider");
  }, [input, thread]);

  const scrollToBottom = useCallback((animated = true) => {
    try {
      listRef.current?.scrollToEnd({ animated });
    } catch {
      // لا شيء — القائمة غير جاهزة بعد
    }
  }, []);

  useEffect(() => {
    if (thread) {
      scrollToBottom(false);
    }
  }, [thread, scrollToBottom]);

  const handleSubmit = async () => {
    const id = thread?.threadId;
    if (sending || !id || !account) return;
    const pendingText = input.trim();
    if (!pendingText && !pendingAttachment) return;
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSending(true);
    const attachmentToSend = pendingAttachment;
    const replyTarget = replyingTo;
    setPendingAttachment(null);
    setReplyingTo(null);
    setInput("");
    scrollToBottom();
    setOptimistic((current) => [
      ...current,
      {
        id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        threadId: id,
        senderRole: "provider",
        text: replyTarget
          ? `ردًا على: ${replyTarget.text || (replyTarget.attachment ? "مرفق" : "")}\n\n${pendingText}`
          : pendingText,
        attachment: attachmentToSend ?? undefined,
        createdAt: Date.now(),
        deliveryStatus: "sending",
        _optimistic: true,
      },
    ]);
    try {
      const baseText = replyTarget
        ? `ردًا على: ${replyTarget.text || (replyTarget.attachment ? "مرفق" : "")}\n\n${pendingText}`
        : pendingText;
      if (attachmentToSend) {
        const message = await sendAttachmentMessage(id, "provider", attachmentToSend, baseText);
        if (!message) {
          setError("تعذر إرسال المرفق.");
        }
      } else {
        const message = await sendMessage(id, "provider", baseText);
        if (!message) {
          setError("تعذر إرسال الرسالة.");
        }
      }
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setOptimistic((current) =>
        current.map((message) =>
          message.deliveryStatus === "sending" ? { ...message, deliveryStatus: "sent" } : message,
        ),
      );
    } finally {
      setSending(false);
    }
    refresh();
  };

  const handleAttachmentPicked = (attachment: ChatAttachment) => {
    setPendingAttachment(attachment);
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const displayed: (ChatMessage | OptimisticMessage)[] = [...messages, ...optimistic].sort(
    (a, b) => a.createdAt - b.createdAt,
  );

  const renderMessage = ({ item, index }: { item: ChatMessage | OptimisticMessage; index: number }) => {
    const isProvider = item.senderRole === "provider";
    const hasContent = item.attachment || item.text.length > 0;
    if (!hasContent) return null;
    const previous = index > 0 ? displayed[index - 1] : null;
    const isGrouped = previous !== null && previous.senderRole === item.senderRole;
    const optimisticTag = (item as OptimisticMessage)._optimistic;
    const quoted = item.replyToId
      ? messages.find((message) => message.id === item.replyToId)
      : undefined;
    return (
      <Pressable
        onLongPress={() => {
          if (isProvider) return;
          if (Platform.OS !== "web") {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          setReplyingTo(item as ChatMessage);
        }}
        delayLongPress={450}
        style={({ pressed }) => [pressed && { opacity: 0.7 }]}
      >
        <View
          style={[
            styles.bubbleRow,
            isProvider ? styles.myBubbleRow : styles.theirBubbleRow,
            isGrouped ? styles.groupedRow : undefined,
          ]}
        >
          <View
            style={[
              styles.bubble,
              isProvider ? styles.myBubble : styles.theirBubble,
              isGrouped
                ? isProvider
                  ? styles.myGroupedBubble
                  : styles.theirGroupedBubble
                : undefined,
            ]}
          >
            {quoted ? (
              <View style={styles.quoteCard}>
                <View style={styles.quoteBar} />
                <Text style={styles.quoteText} numberOfLines={2}>
                  {quoted.text || (quoted.attachment ? `مرفق: ${quoted.attachment.fileName}` : "")}
                </Text>
              </View>
            ) : null}
            {item.attachment ? (
              <Pressable
                onPress={item.attachment.kind === "image" ? () => setViewerUri(item.attachment!.uri) : undefined}
                style={({ pressed }) => pressed && { opacity: 0.85 }}
              >
                <MessageAttachmentCard attachment={item.attachment} />
              </Pressable>
            ) : null}
            {item.text ? (
              <Text style={[styles.bubbleText, isProvider ? styles.myBubbleText : styles.theirBubbleText]}>
                {item.text}
              </Text>
            ) : null}
            <View style={styles.metaRow}>
              {isProvider ? (
                <View style={styles.statusMark}>
                  {optimisticTag || item.deliveryStatus === "sending" ? (
                    <MaterialIcons name="schedule" size={10} color="rgba(255,253,248,0.75)" />
                  ) : (
                    <MaterialIcons name="done-all" size={10} color="rgba(255,253,248,0.75)" />
                  )}
                </View>
              ) : null}
              <Text style={[styles.timeText, isProvider ? styles.myTimeText : styles.theirTimeText]}>
                {formatMessageTime(item.createdAt)}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  const renderEmpty = () => (
    <View style={styles.chatEmpty}>
      <View style={styles.emptyIconWrap}>
        <MaterialIcons name="forum" size={36} color="#6B7B3F" />
      </View>
      <Text style={styles.chatEmptyTitle}>ابدأ المحادثة</Text>
      <Text style={styles.chatEmptyText}>
        راسل المريض بشأن الطلب. يمكن لكلا الطرفين إرفاق الصور والتقارير الطبية.
      </Text>
      <View style={styles.emptyHint}>
        <MaterialIcons name="touch-app" size={14} color="#8A8173" />
        <Text style={styles.emptyHintText}>اضغط مطولاً على رسالة المريض للرد عليها</Text>
      </View>
    </View>
  );

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

  if (error) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <View style={styles.centerBlock}>
          <MaterialIcons name="lock" size={40} color="#B55448" />
          <Text style={styles.blockTitle}>المحادثة غير متاحة</Text>
          <Text style={styles.blockText}>{error}</Text>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>العودة للطلبات</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const canSend = input.trim().length > 0 || pendingAttachment !== null;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
      >
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.headerIcon, pressed && { opacity: 0.6 }]}
            onPress={() => router.back()}
          >
            <MaterialIcons name="arrow-forward" size={24} color="#465132" />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>
              {request?.patientName ?? consultation?.patientName ?? "محادثة"}
            </Text>
            {request ? (
              <Text style={styles.headerSubtitle}>{request.specialtyLabel}</Text>
            ) : consultation ? (
              <Text style={styles.headerSubtitle}>
                استشارة — {consultation.specialtyLabel}
                {consultation.scheduledAt
                  ? ` (${new Date(consultation.scheduledAt).toLocaleString("ar-LY")})`
                  : " (فورية)"}
              </Text>
            ) : null}
          </View>
          <View style={styles.headerIcon} />
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

        <FlatList
          ref={listRef}
          data={displayed}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollToBottom(false)}
        />

        {viewerUri ? (
          <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={() => setViewerUri(null)}
          >
            <Pressable style={styles.viewerBackdrop} onPress={() => setViewerUri(null)}>
              <ScrollView contentContainerStyle={styles.viewerContent}>
                <Pressable
                  style={({ pressed }) => [styles.viewerClose, pressed && { opacity: 0.7 }]}
                  onPress={() => setViewerUri(null)}
                >
                  <MaterialIcons name="close" size={22} color="#FFFDF8" />
                </Pressable>
                <Image source={{ uri: viewerUri }} style={styles.viewerImage} resizeMode="contain" />
              </ScrollView>
            </Pressable>
          </Modal>
        ) : null}

        {pendingAttachment ? (
          <AttachmentPreview attachment={pendingAttachment} onRemove={() => setPendingAttachment(null)} />
        ) : null}

        {replyingTo ? (
          <View style={styles.replyPreview}>
            <View style={styles.replyPreviewBar} />
            <View style={styles.replyPreviewCopy}>
              <Text style={styles.replyPreviewLabel}>ردًا على المريض</Text>
              <Text style={styles.replyPreviewText} numberOfLines={2}>
                {replyingTo.text || (replyingTo.attachment ? `مرفق: ${replyingTo.attachment.fileName}` : "")}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.replyCancel, pressed && { opacity: 0.6 }]}
              onPress={() => setReplyingTo(null)}
            >
              <MaterialIcons name="close" size={16} color="#8A8173" />
            </Pressable>
          </View>
        ) : null}

        {otherTyping ? (
          <View style={styles.typingBar}>
            <View style={styles.typingDots}>
              <View style={styles.typingDot} />
              <View style={[styles.typingDot, styles.typingDotMid]} />
              <View style={styles.typingDot} />
            </View>
            <Text style={styles.typingText}>{request?.patientName ?? "المريض"} يكتب الآن...</Text>
          </View>
        ) : null}

        <View style={styles.inputBar}>
          <AttachmentPickerButton onPicked={handleAttachmentPicked} />
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={pendingAttachment ? "أضف وصفًا اختياريًا..." : "اكتب رسالتك..."}
            placeholderTextColor="#B9AFA0"
            returnKeyType="send"
            onSubmitEditing={handleSubmit}
            multiline
            editable={!sending}
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              !canSend && styles.sendDisabled,
              pressed && canSend && { opacity: 0.75 },
              pressed && !canSend && { opacity: 0.7 },
            ]}
            onPress={handleSubmit}
          >
            {sending ? (
              <ActivityIndicator color="#FFFDF8" size="small" />
            ) : (
              <MaterialIcons name="send" size={20} color={canSend ? "#FFFDF8" : "#B9AFA0"} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

function formatMessageTime(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const yesterday =
    !sameDay &&
    now.getTime() - date.getTime() < 24 * 60 * 60 * 1000 &&
    now.getDate() - date.getDate() <= 1;
  if (sameDay) return `${hours}:${minutes}`;
  if (yesterday) return `أمس ${hours}:${minutes}`;
  return `${date.getDate()}/${date.getMonth() + 1} ${hours}:${minutes}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hintBar: {
    backgroundColor: "#F3E9D2",
    borderBottomColor: "#C9A961",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  hintText: { color: "#8A6D2F", fontSize: 11, lineHeight: 16 },
  header: {
    alignItems: "center",
    backgroundColor: "#F8F5ED",
    borderBottomColor: "#E8E0D1",
    borderBottomWidth: 1,
    flexDirection: "row-reverse",
    gap: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerIcon: { width: 36, alignItems: "flex-end" },
  headerCopy: { flex: 1 },
  headerTitle: { color: "#465132", fontSize: 16, fontWeight: "800", textAlign: "right" },
  headerSubtitle: { color: "#8A8173", fontSize: 11, lineHeight: 14, textAlign: "right", marginTop: 2 },
  listContent: { padding: 16, gap: 8, flexGrow: 1 },
  bubbleRow: { flexDirection: "row", width: "100%" },
  myBubbleRow: { justifyContent: "flex-end" },
  theirBubbleRow: { justifyContent: "flex-start" },
  groupedRow: { marginTop: -4 },
  bubble: { borderRadius: 16, maxWidth: "80%", paddingHorizontal: 14, paddingVertical: 9 },
  myBubble: { backgroundColor: "#6B7B3F", borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: "#F0EBDD", borderBottomLeftRadius: 4 },
  myGroupedBubble: { borderTopRightRadius: 5 },
  theirGroupedBubble: { borderTopLeftRadius: 5 },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  myBubbleText: { color: "#FFFDF8" },
  theirBubbleText: { color: "#465132" },
  metaRow: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: 4,
    marginTop: 4,
  },
  statusMark: { height: 12, justifyContent: "center" },
  timeText: { fontSize: 9, marginTop: 0 },
  myTimeText: { color: "rgba(255,253,248,0.75)" },
  theirTimeText: { color: "#9A907E" },
  quoteCard: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.12)",
    borderRadius: 10,
    flexDirection: "row-reverse",
    gap: 8,
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  quoteBar: {
    backgroundColor: "rgba(255,253,248,0.6)",
    borderRadius: 2,
    height: 26,
    width: 3,
  },
  quoteText: {
    color: "rgba(255,253,248,0.85)",
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    textAlign: "right",
  },
  replyPreview: {
    alignItems: "center",
    backgroundColor: "#F0EBDD",
    borderTopColor: "#E8E0D1",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row-reverse",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  replyPreviewBar: {
    backgroundColor: "#6B7B3F",
    borderRadius: 2,
    height: 34,
    width: 3,
  },
  replyPreviewCopy: { flex: 1 },
  replyPreviewLabel: { color: "#6B7B3F", fontSize: 10, fontWeight: "800", textAlign: "right" },
  replyPreviewText: { color: "#786F61", fontSize: 11, lineHeight: 15, textAlign: "right" },
  replyCancel: { padding: 4 },
  typingBar: {
    alignItems: "center",
    backgroundColor: "#F8F5ED",
    borderBottomColor: "#E8E0D1",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row-reverse",
    gap: 8,
    paddingBottom: 6,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  typingDots: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: 4,
    justifyContent: "center",
  },
  typingDot: {
    backgroundColor: "#9A907E",
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  typingDotMid: { opacity: 0.6 },
  typingText: { color: "#8A8173", fontSize: 11 },
  chatEmpty: {
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
    marginTop: 60,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    alignItems: "center",
    backgroundColor: "#F0EBDD",
    borderRadius: 28,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  chatEmptyTitle: { color: "#465132", fontSize: 16, fontWeight: "800" },
  chatEmptyText: { color: "#786F61", fontSize: 12, lineHeight: 19, textAlign: "center" },
  emptyHint: {
    alignItems: "center",
    backgroundColor: "#FFFDF8",
    borderColor: "#E8E0D1",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row-reverse",
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  emptyHintText: { color: "#8A8173", fontSize: 11 },
  inputBar: {
    alignItems: "center",
    backgroundColor: "#FFFDF8",
    borderTopColor: "#E8E0D1",
    borderTopWidth: 1,
    flexDirection: "row-reverse",
    gap: 10,
    padding: 12,
  },
  input: {
    backgroundColor: "#F8F5ED",
    borderColor: "#E8E0D1",
    borderRadius: 20,
    borderWidth: 1,
    color: "#465132",
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    maxHeight: 110,
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 10,
    textAlign: "right",
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: "#6B7B3F",
    borderRadius: 21,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  sendDisabled: { backgroundColor: "#E8E0D1" },
  centerBlock: { alignItems: "center", flex: 1, gap: 14, justifyContent: "center", padding: 32 },
  blockTitle: { color: "#465132", fontSize: 18, fontWeight: "800", textAlign: "center" },
  blockText: { color: "#786F61", fontSize: 13, lineHeight: 20, textAlign: "center" },
  backButton: {
    backgroundColor: "#6B7B3F",
    borderRadius: 18,
    paddingHorizontal: 26,
    paddingVertical: 12,
    marginTop: 8,
  },
  backButtonText: { color: "#FFFDF8", fontSize: 14, fontWeight: "800" },
  viewerBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(20,20,20,0.92)",
    flex: 1,
    justifyContent: "center",
  },
  viewerContent: { alignItems: "center", padding: 20 },
  viewerClose: {
    alignSelf: "flex-start",
    marginBottom: 14,
  },
  viewerImage: {
    borderRadius: 14,
    height: 520,
    width: 330,
  },
});
