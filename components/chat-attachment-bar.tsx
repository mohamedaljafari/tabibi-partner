/**
 * أدوات اختيار المرفقات في الدردشة (صور وتقارير طبية PDF).
 *
 * مكون مشترك بين تطبيق المريض وتطبيق طبيب شريك:
 * - زر (+) يفتح قائمة اختيار: صورة من المكتبة / التقاط صورة / ملف PDF من الجهاز.
 * - بطاقة معاينة للملف المحدد تظهر فوق شريط الكتابة قبل الإرسال.
 */
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

import type { ChatAttachment } from "@/lib/chat";

export type PendingAttachment = ChatAttachment | null;

/** تحويل نتيجة منتقي الملفات إلى ChatAttachment */
export function toAttachment(asset: { uri: string; name?: string; mimeType?: string }): ChatAttachment {
  const mime = (asset.mimeType ?? "").toLowerCase();
  const isImage = mime.startsWith("image/") || /\.(jpe?g|png|gif|webp|heic)$/i.test(asset.name ?? asset.uri);
  const fileName = asset.name || extractFileName(asset.uri);
  return {
    kind: isImage ? "image" : "file",
    fileName,
    mimeType: mime || (isImage ? "image/jpeg" : "application/pdf"),
    uri: asset.uri,
  };
}

function extractFileName(uri: string): string {
  try {
    const decoded = decodeURIComponent(uri);
    const base = decoded.split("/").pop() ?? "ملف";
    return base.split("?")[0] || "ملف";
  } catch {
    return "ملف";
  }
}

/** اختيار صورة من المكتبة */
export async function pickChatImage(): Promise<ChatAttachment | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.8,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return toAttachment({ uri: asset.uri, name: asset.fileName ?? undefined, mimeType: asset.mimeType ?? undefined });
}

/** التقاط صورة بالكاميرا (بعد إذن الكاميرا) */
export async function takeChatPhoto(): Promise<ChatAttachment | null> {
  if (Platform.OS !== "web") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("إذن الكاميرا", "نحتاج إلى إذن الكاميرا لالتقاط صورة.");
      return null;
    }
  }
  const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return toAttachment({ uri: asset.uri, name: asset.fileName ?? undefined, mimeType: asset.mimeType ?? undefined });
}

/** اختيار ملف PDF أو صورة من مستندات الجهاز */
export async function pickChatDocument(): Promise<ChatAttachment | null> {
  if (Platform.OS === "web") {
    return null;
  }
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/*"],
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return toAttachment({ uri: asset.uri, name: asset.name ?? undefined, mimeType: asset.mimeType ?? undefined });
}

/** زر الإرفاق (+) بجانب شريط الكتابة */
export function AttachmentPickerButton({ onPicked }: { onPicked: (attachment: ChatAttachment) => void }) {
  const [pending, setPending] = useState<
    { promise: Promise<ChatAttachment | null>; cancelToken: number } | null
  >(null);

  // إعادة فحص النتيجة بعد عودة التطبيق من منتقي الصور (Android)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextState) => {
      if (nextState === "active" && pending && Platform.OS !== "web") {
        try {
          const raw = await ImagePicker.getPendingResultAsync();
          const result = raw as { canceled: boolean; assets?: Array<{ uri: string; fileName?: string; mimeType?: string }> } | undefined;
          if (result && !result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            const attachment = toAttachment({
              uri: asset.uri,
              name: asset.fileName ?? undefined,
              mimeType: asset.mimeType ?? undefined,
            });
            onPicked(attachment);
            setPending(null);
          }
        } catch {
          // لا شيء — المستخدم ألغى أو لم يعد هناك نتيجة معلقة
        }
      }
    });
    return () => subscription.remove();
  }, [pending, onPicked]);

  const choose = () => {
    if (Platform.OS === "web") {
      void pickChatImage().then((attachment) => {
        if (attachment) onPicked(attachment);
      });
      return;
    }
    Alert.alert(
      "إرفاق ملف",
      "اختر نوع المرفق الذي تريد إرساله في المحادثة",
      [
        { text: "صورة من المكتبة", onPress: () => void dispatch(pickChatImage) },
        { text: "التقاط صورة", onPress: () => void dispatch(takeChatPhoto) },
        { text: "ملف PDF / تقرير طبي", onPress: () => void dispatch(pickChatDocument) },
        { text: "إلغاء", style: "cancel" },
      ],
      { cancelable: true },
    );
  };

  const dispatch = async (picker: () => Promise<ChatAttachment | null>) => {
    const result = await picker();
    if (result) onPicked(result);
    setPending(null);
  };

  return (
    <Pressable
      onPress={choose}
      disabled={Boolean(pending)}
      style={({ pressed }) => [styles.pickerButton, pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }]}
      hitSlop={10}
    >
      <MaterialIcons name="attach-file" size={21} color="#6B7B3F" />
    </Pressable>
  );
}

/** بطاقة معاينة الملف المعلق قبل الإرسال */
export function AttachmentPreview({
  attachment,
  onRemove,
}: {
  attachment: ChatAttachment;
  onRemove: () => void;
}) {
  return (
    <View style={styles.previewRow}>
      {attachment.kind === "image" ? (
        <View style={styles.previewThumb}>
          <MaterialIcons name="image" size={18} color="#FFFDF8" />
        </View>
      ) : (
        <View style={[styles.previewThumb, styles.pdfThumb]}>
          <MaterialIcons name="picture-as-pdf" size={18} color="#FFFDF8" />
        </View>
      )}
      <View style={styles.previewCopy}>
        <Text style={styles.previewName} numberOfLines={1}>
          {attachment.fileName}
        </Text>
        <Text style={styles.previewKind}>
          {attachment.kind === "image" ? "صورة" : "تقرير / ملف"}
        </Text>
      </View>
      <Pressable
        onPress={onRemove}
        style={({ pressed }) => [styles.previewRemove, pressed && { opacity: 0.6 }]}
        hitSlop={10}
      >
        <MaterialIcons name="close" size={16} color="#B55448" />
      </Pressable>
    </View>
  );
}

/** فقاعة معاينة الصورة داخل المحادثة */
export function AttachmentBubbleImage({ uri }: { uri: string }) {
  return (
    <View style={styles.imageBubble}>
      <MaterialIcons name="image" size={20} color="#6B7B3F" />
      <Text style={styles.imageBubbleText}>صورة</Text>
    </View>
  );
}

/** بطاقة المرفق داخل فقاعة الرسالة (للصور والملفات) */
export function MessageAttachmentCard({ attachment }: { attachment: ChatAttachment }) {
  if (attachment.kind === "image") {
    return (
      <View style={styles.messageImageCard}>
        {/* معاينة الصورة الفعلية */}
        <ImagePreview uri={attachment.uri} />
        <View style={styles.attachmentLabel}>
          <MaterialIcons name="image" size={13} color="#8A6D2F" />
          <Text style={styles.attachmentLabelText} numberOfLines={1}>
            {attachment.fileName}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.messageFileCard}>
      <View style={styles.fileIconWrap}>
        <MaterialIcons name="picture-as-pdf" size={22} color="#B55448" />
      </View>
      <View style={styles.fileCopy}>
        <Text style={styles.fileNameText} numberOfLines={2}>
          {attachment.fileName}
        </Text>
        <Text style={styles.fileSubText}>تقرير طبي / ملف</Text>
      </View>
    </View>
  );
}

/** معاينة الصورة الفعلية: expo-image على الأجهزة وimg على الويب */
function ImagePreview({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View style={styles.imagePlaceholder}>
        <MaterialIcons name="image" size={26} color="#FFFDF8" />
        <Text style={styles.imagePlaceholderText}>صورة</Text>
      </View>
    );
  }
  if (Platform.OS === "web") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Img = require("react-native").Image as any;
    return <Img source={{ uri }} style={styles.imagePreview} onError={() => setFailed(true)} />;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Image } = require("expo-image") as {
      Image: (props: { source: { uri: string }; style: object; onError?: () => void }) => React.ReactElement;
    };
    return (
      <Image
        source={{ uri }}
        style={styles.imagePreview}
        onError={() => setFailed(true)}
      />
    );
  } catch {
    return (
      <View style={styles.imagePlaceholder}>
        <MaterialIcons name="image" size={26} color="#FFFDF8" />
        <Text style={styles.imagePlaceholderText}>صورة</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  pickerButton: {
    alignItems: "center",
    backgroundColor: "#F8F5ED",
    borderColor: "#E8E0D1",
    borderRadius: 21,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  previewRow: {
    alignItems: "center",
    backgroundColor: "#FFFDF8",
    borderTopColor: "#E8E0D1",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row-reverse",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  previewThumb: {
    alignItems: "center",
    backgroundColor: "#6B7B3F",
    borderRadius: 12,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  pdfThumb: { backgroundColor: "#B55448" },
  previewCopy: { flex: 1 },
  previewName: { color: "#465132", fontSize: 12, fontWeight: "700" },
  previewKind: { color: "#8A8173", fontSize: 10, marginTop: 1 },
  previewRemove: { padding: 4 },
  imageBubble: {
    alignItems: "center",
    flexDirection: "row-reverse",
    gap: 6,
    marginTop: 4,
  },
  imageBubbleText: { color: "rgba(255,253,248,0.85)", fontSize: 11 },
  messageImageCard: {
    borderRadius: 12,
    marginBottom: 4,
    overflow: "hidden",
    width: 210,
  },
  imagePreview: { height: 150, width: 210 },
  imagePlaceholder: {
    alignItems: "center",
    backgroundColor: "rgba(255,253,248,0.18)",
    flexDirection: "row-reverse",
    gap: 6,
    height: 150,
    justifyContent: "center",
    width: 210,
  },
  imagePlaceholderText: { color: "rgba(255,253,248,0.9)", fontSize: 12 },
  attachmentLabel: {
    alignItems: "center",
    backgroundColor: "#F3E9D2",
    flexDirection: "row-reverse",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  attachmentLabelText: { color: "#8A6D2F", flex: 1, fontSize: 10 },
  messageFileCard: {
    alignItems: "center",
    backgroundColor: "#FFFDF8",
    borderColor: "#E4DCCB",
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row-reverse",
    gap: 10,
    marginBottom: 4,
    padding: 10,
    width: 210,
  },
  fileIconWrap: {
    alignItems: "center",
    backgroundColor: "#F6EDED",
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  fileCopy: { flex: 1 },
  fileNameText: { color: "#465132", fontSize: 11, fontWeight: "700", lineHeight: 15 },
  fileSubText: { color: "#8A8173", fontSize: 10, marginTop: 2 },
});
