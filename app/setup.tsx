import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import {
  completeProviderProfile,
  getSessionAccount,
  hasProfileErrors,
  PROVIDER_SPECIALIZATIONS,
  validateProfileCompletion,
  type ProfileCompletionInput,
  type ProviderDocument,
} from "@/lib/provider-auth";

type DocInput = {
  name: string;
  url: string;
};

export default function SetupScreen() {
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [yearsOfExperience, setYearsOfExperience] = useState(0);
  const [bio, setBio] = useState("");
  const [documents, setDocuments] = useState<DocInput[]>([{ name: "", url: "" }]);
  const [busy, setBusy] = useState(false);

  const toggleSpecialization = (spec: string) => {
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setSpecializations((current) =>
      current.includes(spec) ? current.filter((item) => item !== spec) : [...current, spec],
    );
  };

  const updateDocument = (index: number, field: keyof DocInput, value: string) => {
    setDocuments((current) =>
      current.map((doc, item) =>
        item === index ? { ...doc, [field]: value } : doc,
      ),
    );
  };

  const addDocument = () => {
    setDocuments((current) => [...current, { name: "", url: "" }]);
  };

  const removeDocument = (index: number) => {
    setDocuments((current) => current.filter((_, item) => item !== index));
  };

  const handleConfirm = async () => {
    if (busy) return;
    const account = await getSessionAccount();
    if (!account) {
      Alert.alert("خطأ", "لم يتم العثور على حسابك، سجّل الدخول مجددًا.");
      router.replace("/login");
      return;
    }

    const filledDocs: DocInput[] = documents.filter((doc) => doc.name.trim() && doc.url.trim());
    const input: ProfileCompletionInput = {
      specializations,
      yearsOfExperience,
      bio,
      photoUri: undefined,
      documents: filledDocs.map<ProviderDocument>((doc, index) => ({
        id: `${Date.now()}-${index}`,
        type: "certificate",
        name: doc.name.trim(),
        uri: doc.url.trim(),
      })),
      services: [],
      availability: {
        availableNow: true,
        slots: [],
      },
    };

    const validation = validateProfileCompletion(input);
    const errors = hasProfileErrors(validation);
    if (errors) {
      Alert.alert("بيانات غير مكتملة", "اختر تخصصًا واحدًا على الأقل وادخل اسم المستندات وروابطها.");
      return;
    }

    setBusy(true);
    try {
      const result = await completeProviderProfile(account.id, input);
      if (!result.success) {
        Alert.alert("تعذر حفظ البيانات", result.error ?? "جرّب مرة أخرى.");
        return;
      }
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert(
        "تم استلام بياناتك",
        "سيتم مراجعة مستنداتك وبياناتك من الإدارة وتفعيل حسابك، ستصلك إشعارات بأي تحديث.",
        [
          {
            text: "حسنًا",
            onPress: () => router.replace("/home" as never),
          },
        ],
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer className="px-6">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
          <View className="items-center gap-2 mt-4 mb-6">
            <Text className="text-3xl font-bold text-foreground">استكمال بياناتك</Text>
            <Text className="text-sm text-muted text-center leading-6">
              تخصصاتك وخبراتك ومستنداتك ستُراجع من الإدارة قبل تفعيل الحساب.
            </Text>
          </View>

          <View className="gap-8">
            <View className="gap-3">
              <Text className="text-base font-bold text-foreground">تخصصاتك (يمكن اختيار أكثر من تخصص)</Text>
              <View className="flex-row flex-wrap gap-2">
                {PROVIDER_SPECIALIZATIONS.map((spec) => {
                  const selected = specializations.includes(spec);
                  return (
                    <Pressable
                      key={spec}
                      onPress={() => toggleSpecialization(spec)}
                      style={({ pressed }) => [
                        styles.chip,
                        selected ? styles.chipSelected : styles.chipNormal,
                        pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
                      ]}
                    >
                      <Text
                        style={[styles.chipText, selected && styles.chipTextSelected]}
                      >
                        {spec}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="gap-3">
              <Text className="text-base font-bold text-foreground">سنوات الخبرة</Text>
              <View className="flex-row flex-wrap gap-2">
                {[0, 1, 2, 3, 5, 7, 10, 15, 20, 25, 30].map((years) => {
                  const selected = yearsOfExperience === years;
                  return (
                    <Pressable
                      key={years}
                      onPress={() => setYearsOfExperience(years)}
                      style={({ pressed }) => [
                        styles.chip,
                        selected ? styles.chipSelected : styles.chipNormal,
                        pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
                      ]}
                    >
                      <Text
                        style={[styles.chipText, selected && styles.chipTextSelected]}
                      >
                        {years === 0 ? "أقل من سنة" : `${years}+`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="gap-2">
              <Text className="text-base font-bold text-foreground">نبذة عنك (تظهر للمرضى)</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="اكتب نبذة مختصرة عن خبراتك وطريقة عملك..."
                placeholderTextColor="#8A8173"
                multiline
                textAlign="right"
                className="rounded-2xl border border-border bg-surface px-4 py-4 text-foreground"
                style={styles.inputText}
              />
            </View>

            <View className="gap-3">
              <Text className="text-base font-bold text-foreground">المستندات (الشهادة، إذن المزاولة، ترخيص العمل)</Text>
              {documents.map((doc, index) => (
                <View key={index} className="gap-2 border border-border bg-surface rounded-2xl p-3">
                  <TextInput
                    value={doc.name}
                    onChangeText={(value) => updateDocument(index, "name", value)}
                    placeholder="اسم المستند (مثل: شهادة المزاولة)"
                    placeholderTextColor="#8A8173"
                    textAlign="right"
                    className="rounded-xl border border-border bg-background px-3 py-3 text-foreground"
                    style={styles.inputText}
                  />
                  <TextInput
                    value={doc.url}
                    onChangeText={(value) => updateDocument(index, "url", value)}
                    placeholder="رابط أو وصف المستند"
                    placeholderTextColor="#8A8173"
                    textAlign="right"
                    className="rounded-xl border border-border bg-background px-3 py-3 text-foreground"
                    style={styles.inputText}
                  />
                  {index > 0 && (
                    <Pressable
                      onPress={() => removeDocument(index)}
                      style={({ pressed }) => [{ alignSelf: "flex-start", padding: 4 }, pressed && { opacity: 0.7 }]}
                    >
                      <Text style={styles.removeText}>حذف المستند</Text>
                    </Pressable>
                  )}
                </View>
              ))}
              <Pressable
                onPress={addDocument}
                style={({ pressed }) => [styles.addDoc, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.addDocText}>+ إضافة مستند آخر</Text>
              </Pressable>
              <Text style={styles.docHint}>
                المستندات لا تظهر للمرضى، وتتطلب موافقة الإدارة قبل تفعيل حسابك.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleConfirm}
            disabled={busy}
            style={({ pressed }) => [
              styles.button,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
              busy && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.buttonText}>{busy ? "جارٍ الحفظ..." : "تأكيد واستكمال"}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  inputText: { fontSize: 14, lineHeight: 20, textAlign: "right" },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipNormal: { borderColor: "#C9A961", backgroundColor: "#FDFBF7" },
  chipSelected: { borderColor: "#6B7B3F", backgroundColor: "#6B7B3F" },
  chipText: { color: "#6B7B3F", fontSize: 13, fontWeight: "700" },
  chipTextSelected: { color: "#FFFDF8" },
  removeText: { color: "#B55448", fontSize: 12, fontWeight: "700" },
  addDoc: {
    alignItems: "center",
    backgroundColor: "#FDFBF7",
    borderColor: "#C9A961",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
  },
  addDocText: { color: "#8A6D2F", fontSize: 13, fontWeight: "700" },
  docHint: { color: "#8A8173", fontSize: 11, lineHeight: 16, textAlign: "right" },
  button: {
    alignItems: "center",
    backgroundColor: "#6B7B3F",
    borderRadius: 999,
    paddingVertical: 15,
    marginTop: 8,
  },
  buttonText: { color: "#FFFDF8", fontSize: 16, fontWeight: "800" },
});
