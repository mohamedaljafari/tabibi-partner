import { useCallback, useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import {
  getSessionAccount,
  updateProviderServices,
  type ProviderAccount,
} from "@/lib/provider-auth";
import {
  getServicesForSpecialization,
  hasServicesErrors,
  SPECIALIZATION_SERVICES,
  validateProviderServices,
  type ProviderService,
} from "@/lib/provider-services";

type Draft = { name: string; price: string; duration: string };

const EMPTY_DRAFT: Draft = { name: "", price: "", duration: "" };

function formatNumber(value: string): number {
  const parsed = parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

export default function ServicesScreen() {
  const [account, setAccount] = useState<ProviderAccount | null>(null);
  const [services, setServices] = useState<ProviderService[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    void getSessionAccount().then((current) => {
      if (!current) return;
      setAccount(current);
      setServices(current.services ?? []);
    });
  };

  useFocusEffect(useCallback(reload, []));
  useEffect(() => {
    reload();
  }, []);

  const suggestedServices = account
    ? account.specializations
        .map((spec) => getServicesForSpecialization(spec))
        .flat()
        .filter((name, index, list) => list.indexOf(name) === index)
    : [];

  const addSuggested = (name: string) => {
    if (busy || saving) return;
    if (services.some((service) => service.name === name)) return;
    const next = [
      ...services,
      { id: `svc-${Date.now()}`, name, price: 0, isCustom: false },
    ];
    setServices(next);
    void saveServices(next);
  };

  const addCustom = () => {
    if (busy || saving) return;
    const name = draft.name.trim();
    const price = formatNumber(draft.price);
    const duration = draft.duration.trim() ? parseInt(draft.duration, 10) : undefined;
    if (!name || price <= 0) {
      Alert.alert("بيانات غير صالحة", "اكتب اسم الخدمة وسعرًا صحيحًا أكبر من صفر.");
      return;
    }
    const next = [
      ...services,
      {
        id: `svc-${Date.now()}`,
        name,
        price,
        isCustom: true,
        durationMinutes: Number.isFinite(duration ?? 0) && (duration ?? 0) > 0 ? duration : undefined,
      },
    ];
    setServices(next);
    setDraft(EMPTY_DRAFT);
    void saveServices(next);
  };

  const removeService = (service: ProviderService) => {
    if (busy || saving) return;
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const next = services.filter((item) => item.id !== service.id);
    setServices(next);
    void saveServices(next);
  };

  const saveServices = async (updated: ProviderService[]) => {
    const current = await getSessionAccount();
    if (!current) return;
    setSaving(true);
    try {
      const result = await updateProviderServices(current.id, updated);
      if (!result.success) {
        Alert.alert("تعذر الحفظ", result.error ?? "جرّب مرة أخرى.");
      } else if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } finally {
      setSaving(false);
    }
  };

  const setPrice = (service: ProviderService, price: number) => {
    if (busy || saving) return;
    const next = services.map((item) =>
      item.id === service.id ? { ...item, price } : item,
    );
    setServices(next);
    void saveServices(next);
  };

  const pendingValidation = validateProviderServices(services);

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <View className="gap-2 mt-2 mb-4">
            <Text className="text-2xl font-bold text-foreground">خدماتك</Text>
            <Text className="text-sm text-muted leading-6">
              أضف خدماتك وحدد سعرها ومدة كل خدمة. تظهر للمريض عند عرض ملفك.
            </Text>
          </View>

          <View className="rounded-2xl border border-border bg-surface p-4 gap-3">
            <Text className="text-base font-bold text-foreground">
              خدماتك الحالية ({services.length})
            </Text>
            {services.length === 0 ? (
              <Text className="text-sm text-muted">لم تضف خدمات بعد.</Text>
            ) : (
              services.map((service) => (
                <View key={service.id} className="gap-2 border-b border-border pb-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-semibold text-foreground flex-1">
                      {service.name}
                      {service.durationMinutes ? ` · ${service.durationMinutes} دقيقة` : ""}
                    </Text>
                    <Pressable
                      onPress={() => removeService(service)}
                      style={({ pressed }) => [{ padding: 6 }, pressed && { opacity: 0.6 }]}
                    >
                      <Text style={styles.removeText}>حذف</Text>
                    </Pressable>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm text-muted">السعر (د.ل):</Text>
                    <TextInput
                      value={service.price > 0 ? String(service.price) : ""}
                      onChangeText={(value) => setPrice(service, formatNumber(value))}
                      placeholder="0"
                      placeholderTextColor="#8A8173"
                      keyboardType="decimal-pad"
                      className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-foreground"
                      style={styles.smallInput}
                    />
                  </View>
                </View>
              ))
            )}
            {services.length > 0 && hasServicesErrors(pendingValidation) && (
              <Text style={styles.errorText}>حدد سعرًا صحيحًا لكل خدمة.</Text>
            )}
          </View>

          <View className="rounded-2xl border border-border bg-surface p-4 gap-3 mt-4">
            <Text className="text-base font-bold text-foreground">خدمات مقترحة حسب تخصصاتك</Text>
            <View className="flex-row flex-wrap gap-2">
              {suggestedServices
                .filter((name) => !services.some((service) => service.name === name))
                .map((name) => {
                  const added = services.some((service) => service.name === name);
                  return (
                    <Pressable
                      key={name}
                      onPress={() => !added && addSuggested(name)}
                      disabled={added}
                      style={({ pressed }) => [
                        styles.suggestChip,
                        added && styles.suggestChipDisabled,
                        pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
                      ]}
                    >
                      <Text style={[styles.suggestChipText, added && styles.suggestChipTextDisabled]}>
                        {name}
                      </Text>
                    </Pressable>
                  );
                })}
              {suggestedServices.length === 0 && (
                <Text className="text-sm text-muted">
                  أكمل تخصصاتك في بياناتك لتظهر الخدمات المقترحة.
                </Text>
              )}
            </View>
          </View>

          <View className="rounded-2xl border border-border bg-surface p-4 gap-3 mt-4">
            <Text className="text-base font-bold text-foreground">إضافة خدمة جديدة</Text>
            <TextInput
              value={draft.name}
              onChangeText={(value) => setDraft((current) => ({ ...current, name: value }))}
              placeholder="اسم الخدمة"
              placeholderTextColor="#8A8173"
              textAlign="right"
              className="rounded-xl border border-border bg-background px-3 py-3 text-foreground"
              style={styles.inputText}
            />
            <View className="flex-row gap-2">
              <TextInput
                value={draft.price}
                onChangeText={(value) => setDraft((current) => ({ ...current, price: value }))}
                placeholder="السعر (د.ل)"
                placeholderTextColor="#8A8173"
                keyboardType="decimal-pad"
                className="flex-1 rounded-xl border border-border bg-background px-3 py-3 text-foreground"
                style={styles.inputText}
              />
              <TextInput
                value={draft.duration}
                onChangeText={(value) => setDraft((current) => ({ ...current, duration: value }))}
                placeholder="المدة (دقيقة)"
                placeholderTextColor="#8A8173"
                keyboardType="numeric"
                className="flex-1 rounded-xl border border-border bg-background px-3 py-3 text-foreground"
                style={styles.inputText}
              />
            </View>
            <Pressable
              onPress={addCustom}
              style={({ pressed }) => [styles.button, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
            >
              <Text style={styles.buttonText}>+ إضافة الخدمة</Text>
            </Pressable>
          </View>

          {saving && (
            <Text className="text-xs text-muted text-center mt-3">جارٍ الحفظ...</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  inputText: { fontSize: 14, lineHeight: 20, textAlign: "right" },
  smallInput: { fontSize: 13, lineHeight: 18, textAlign: "right", paddingVertical: 4 },
  removeText: { color: "#B55448", fontSize: 12, fontWeight: "700" },
  errorText: { color: "#B55448", fontSize: 11, lineHeight: 16 },
  suggestChip: {
    backgroundColor: "#F3E9D2",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#C9A961",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  suggestChipDisabled: { opacity: 0.5, borderColor: "#6B7B3F", backgroundColor: "#E6EADC" },
  suggestChipText: { color: "#8A6D2F", fontSize: 12, fontWeight: "700" },
  suggestChipTextDisabled: { color: "#6B7B3F", textDecorationLine: "line-through" },
  button: {
    alignItems: "center",
    backgroundColor: "#6B7B3F",
    borderRadius: 999,
    paddingVertical: 12,
  },
  buttonText: { color: "#FFFDF8", fontSize: 14, fontWeight: "800" },
});
