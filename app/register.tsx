import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { FormField } from "@/components/form-field";
import { ScreenContainer } from "@/components/screen-container";
import {
  PROVIDER_ROLES,
  registerProvider,
  validateRegistration,
  type RegistrationInput,
  type RegistrationValidation,
} from "@/lib/provider-auth";
import { normalizeLibyanPhone } from "@/lib/libya";

const INITIAL_FORM: RegistrationInput = {
  fullName: "",
  role: "طبيب",
  phone: "",
  password: "",
  confirmPassword: "",
};

export default function RegisterScreen() {
  const [form, setForm] = useState<RegistrationInput>(INITIAL_FORM);
  const [errors, setErrors] = useState<RegistrationValidation>({
    fullName: "",
    role: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string>("");

  const updateField = (field: keyof RegistrationInput, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field in errors && errors[field as keyof RegistrationValidation]) {
      setErrors((current) => ({ ...current, [field as keyof RegistrationValidation]: "" }));
    }
    setGlobalError("");
  };

  const handleRegister = async () => {
    const validation = validateRegistration(form);
    setErrors(validation);
    if (validation.fullName || validation.role || validation.phone || validation.password || validation.confirmPassword) {
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await registerProvider({ ...form, phone: normalizeLibyanPhone(form.phone) });
      if (!result.success || !result.account) {
        setGlobalError(result.error ?? "فشل إنشاء الحساب");
        return;
      }
      // بعد إنشاء الحساب ينتقل إلى صفحة إتمام البيانات
      router.replace("/setup");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-background">
      <View style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.logoText}>طبيب شريك</Text>
            <Text style={styles.title}>أهلًا بك في شبكة مقدمي الخدمة</Text>
            <Text style={styles.subtitle}>سجّل حسابك لتقديم خدماتك الصحية المنزلية للمرضى.</Text>
          </View>
          <View style={styles.formCard}>
            <Text style={styles.formHeading}>بيانات الحساب</Text>
            <FormField
              label="الاسم الكامل"
              value={form.fullName}
              onChangeText={(value) => updateField("fullName", value)}
              placeholder="اكتب اسمك الكامل"
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
              error={errors.fullName}
            />
            <FormField
              label="الصفة"
              value={form.role}
              onChangeText={(value) => updateField("role", value)}
              placeholder="مثال: طبيب، ممرض، أخصائي"
              autoCapitalize="words"
              returnKeyType="next"
              error={errors.role}
            />
            <View style={styles.roleChips}>
              {PROVIDER_ROLES.map((role) => (
                <Pressable
                  key={role}
                  accessibilityRole="button"
                  accessibilityLabel={role}
                  onPress={() => updateField("role", role)}
                  style={({ pressed }) => [styles.roleChip, form.role === role && styles.roleChipActive, pressed && styles.roleChipPressed]}
                >
                  <Text style={[styles.roleChipText, form.role === role && styles.roleChipTextActive]}>{role}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.roleHint}>أو اكتب صفتك مباشرة في الحقل أعلاه إذا لم تكن موجودة في القائمة.</Text>
            <FormField
              label="رقم الهاتف"
              value={form.phone}
              onChangeText={(value) => updateField("phone", value)}
              placeholder="مثال: 0912345678 أو +218912345678"
              keyboardType="phone-pad"
              autoComplete="tel"
              returnKeyType="next"
              error={errors.phone}
            />
            <FormField
              label="كلمة المرور"
              value={form.password}
              onChangeText={(value) => updateField("password", value)}
              placeholder="8 أحرف على الأقل"
              autoComplete="new-password"
              secure
              returnKeyType="next"
              error={errors.password}
            />
            <FormField
              label="تأكيد كلمة المرور"
              value={form.confirmPassword}
              onChangeText={(value) => updateField("confirmPassword", value)}
              placeholder="أعد إدخال كلمة المرور"
              autoComplete="new-password"
              secure
              returnKeyType="done"
              onSubmitEditing={handleRegister}
              error={errors.confirmPassword}
            />
            {globalError ? <Text style={styles.globalError}>{globalError}</Text> : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="إنشاء الحساب"
            disabled={isSubmitting}
            onPress={handleRegister}
            style={({ pressed }) => [styles.primaryButton, (pressed || isSubmitting) && styles.primaryButtonPressed]}
          >
            <Text style={styles.primaryButtonText}>{isSubmitting ? "جارٍ إنشاء الحساب..." : "إنشاء الحساب"}</Text>
          </Pressable>
          <Text style={styles.privacy}>بالمتابعة، أنت توافق على مشاركة بياناتك مع لوحة التحكم لإتمام تفعيل حسابك.</Text>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "flex-start", paddingBottom: 16, paddingHorizontal: 18, paddingTop: 4 },
  header: { alignItems: "center", marginBottom: 6, marginTop: 8 },
  logoText: { color: "#6B7B3F", fontSize: 24, fontWeight: "900", lineHeight: 32 },
  title: { color: "#465132", fontSize: 20, fontWeight: "800", lineHeight: 28, marginTop: 2, textAlign: "center" },
  subtitle: { color: "#8A8173", fontSize: 14, lineHeight: 21, marginTop: 5, maxWidth: 320, textAlign: "center" },
  formCard: {
    backgroundColor: "#FFFDF8",
    borderColor: "#E4DCCB",
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    padding: 12,
    shadowColor: "#6B7B3F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
  },
  formHeading: { color: "#465132", fontSize: 16, fontWeight: "800", marginBottom: 4, textAlign: "right" },
  roleChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  roleChip: {
    borderColor: "#E4DCCB",
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  roleChipActive: { backgroundColor: "#6B7B3F", borderColor: "#6B7B3F" },
  roleChipPressed: { opacity: 0.8 },
  roleChipText: { color: "#8A8173", fontSize: 13, fontWeight: "600" },
  roleChipTextActive: { color: "#FFFFFF" },
  roleHint: { color: "#8A8173", fontSize: 12, lineHeight: 17, marginTop: 4, textAlign: "right" },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#6B7B3F",
    borderRadius: 16,
    justifyContent: "center",
    marginTop: 10,
    minHeight: 46,
    shadowColor: "#6B7B3F",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  primaryButtonPressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  globalError: { color: "#B55448", fontSize: 13, lineHeight: 19, marginTop: 2, textAlign: "center" },
  privacy: { color: "#8A8173", fontSize: 12, lineHeight: 18, marginHorizontal: 14, marginTop: 12, textAlign: "center" },
});
