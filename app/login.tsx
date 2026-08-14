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
  getSessionAccount,
  signInProvider,
} from "@/lib/provider-auth";

export default function PartnerLoginScreen() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    if (busy) return;
    if (phone.trim().length < 8) {
      Alert.alert("بيانات غير مكتملة", "أدخل رقم الهاتف كما سُجل به الحساب.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("بيانات غير مكتملة", "أدخل كلمة المرور (8 أحرف على الأقل).");
      return;
    }
    setBusy(true);
    try {
      const result = await signInProvider(phone.trim(), password);
      if (!result.success || !result.account) {
        Alert.alert(
          "تعذر تسجيل الدخول",
          result.error ?? "رقم الهاتف أو كلمة المرور غير صحيحة، جرّب مرة أخرى أو أنشئ حسابًا جديدًا.",
        );
        if (Platform.OS !== "web") {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        return;
      }
      const account = result.account;
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      if (account.status === "active" || account.status === "pending") {
        router.replace("/home" as never);
      } else {
        Alert.alert("الحساب معطّل", "حسابك موقوف حاليًا، تواصل مع الإدارة لمعالجة ذلك.");
      }
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
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <View className="flex-1 justify-center gap-6">
            <View className="items-center gap-3">
              <Text style={styles.logoText}>طبيب شريك</Text>
              <Text className="text-3xl font-bold text-foreground">تسجيل الدخول</Text>
              <Text className="text-sm text-muted text-center leading-6">
                أدخل رقم الهاتف وكلمة المرور للمتابعة إلى لوحة الشراكة الخاصة بك.
              </Text>
            </View>

            <View className="gap-4">
              <View className="gap-2">
                <Text className="text-sm font-bold text-foreground">رقم الهاتف</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="رقم الهاتف المسجل"
                  placeholderTextColor="#8A8173"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                  className="rounded-2xl border border-border bg-surface px-4 py-4 text-foreground"
                  style={styles.inputText}
                />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-bold text-foreground">كلمة المرور</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="أدخل كلمة المرور"
                  placeholderTextColor="#8A8173"
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                  className="rounded-2xl border border-border bg-surface px-4 py-4 text-foreground"
                  style={styles.inputText}
                />
              </View>
            </View>

            <Pressable
              onPress={handleSignIn}
              disabled={busy}
              style={({ pressed }) => [
                styles.button,
                pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
                busy && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.buttonText}>{busy ? "جارٍ الدخول..." : "تسجيل الدخول"}</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (Platform.OS !== "web") {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                router.replace("/register");
              }}
              style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.linkText}>ليس لديك حساب؟ إنشاء حساب جديد</Text>
            </Pressable>

            <Text style={styles.hint}>
              يُفعَّل حسابك بعد مراجعة الإدارة للمستندات والبيانات المسجلة.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  inputText: { fontSize: 15, lineHeight: 22, textAlign: "right" },
  logoText: { color: "#6B7B3F", fontSize: 22, fontWeight: "900" },
  button: {
    alignItems: "center",
    backgroundColor: "#6B7B3F",
    borderRadius: 999,
    paddingVertical: 15,
  },
  buttonText: { color: "#FFFDF8", fontSize: 16, fontWeight: "800" },
  link: { alignItems: "center", paddingVertical: 4 },
  linkText: { color: "#8A8173", fontSize: 13, fontWeight: "700" },
  hint: { color: "#8A8173", fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 2 },
});
