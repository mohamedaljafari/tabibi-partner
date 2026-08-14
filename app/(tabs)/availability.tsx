import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import {
  getSessionAccount,
  updateProviderAvailability,
  type ProviderAccount,
} from "@/lib/provider-auth";
import {
  hasAvailabilityErrors,
  TIME_SLOTS,
  validateAvailability,
  WEEKDAYS,
  type AvailabilitySlot,
  type ProviderAvailability,
} from "@/lib/provider-services";

const DEFAULT_SLOT: AvailabilitySlot = {
  day: "saturday",
  startHour: "08",
  endHour: "16",
};

export default function AvailabilityScreen() {
  const [account, setAccount] = useState<ProviderAccount | null>(null);
  const [availability, setAvailability] = useState<ProviderAvailability>({
    availableNow: true,
    slots: [],
  });
  const [draft, setDraft] = useState<AvailabilitySlot>(DEFAULT_SLOT);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    void getSessionAccount().then((current) => {
      if (!current) return;
      setAccount(current);
      setAvailability(current.availability ?? { availableNow: true, slots: [] });
    });
  };

  useFocusEffect(useCallback(reload, []));
  useEffect(() => {
    reload();
  }, []);

  const saveAvailability = async (updated: ProviderAvailability) => {
    const current = await getSessionAccount();
    if (!current) return;
    setSaving(true);
    try {
      const result = await updateProviderAvailability(current.id, updated);
      if (!result.success) {
        Alert.alert("تعذر الحفظ", result.error ?? "جرّب مرة أخرى.");
      } else if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailableNow = () => {
    if (saving) return;
    const updated: ProviderAvailability = {
      ...availability,
      availableNow: !availability.availableNow,
    };
    setAvailability(updated);
    void saveAvailability(updated);
  };

  const addSlot = () => {
    if (saving) return;
    const start = parseInt(draft.startHour, 10);
    const end = parseInt(draft.endHour, 10);
    if (end <= start) {
      Alert.alert("موعد غير صالح", "وقت النهاية يجب أن يكون لاحقًا لوقت البداية.");
      return;
    }
    const slot: AvailabilitySlot = { ...draft };
    const updated: ProviderAvailability = {
      ...availability,
      slots: [...availability.slots, slot],
    };
    setAvailability(updated);
    void saveAvailability(updated);
  };

  const removeSlot = (target: AvailabilitySlot) => {
    if (saving) return;
    const updated: ProviderAvailability = {
      ...availability,
      slots: availability.slots.filter(
        (item) => !(item.day === target.day && item.startHour === target.startHour && item.endHour === target.endHour),
      ),
    };
    setAvailability(updated);
    void saveAvailability(updated);
  };

  const groupByDay = new Map<AvailabilitySlot["day"], AvailabilitySlot[]>();
  for (const slot of availability.slots) {
    const list = groupByDay.get(slot.day) ?? [];
    list.push(slot);
    groupByDay.set(slot.day, list);
  };

  const pendingValidation = validateAvailability(availability);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 32 }}>
        <View className="gap-2 mt-2 mb-4">
          <Text className="text-2xl font-bold text-foreground">مواعيدك</Text>
          <Text className="text-sm text-muted leading-6">
            حدّث حالتك ووقتك المتاح ليصلك المرضى في الوقت المناسب.
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-surface p-4 gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-foreground">متاح الآن</Text>
            <Pressable
              onPress={toggleAvailableNow}
              style={({ pressed }) => [
                styles.toggle,
                availability.availableNow ? styles.toggleOn : styles.toggleOff,
                pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
              ]}
            >
              <Text style={styles.toggleText}>
                {availability.availableNow ? "متاح" : "غير متاح"}
              </Text>
            </Pressable>
          </View>
          <Text className="text-xs text-muted leading-5">
            {availability.availableNow
              ? "حالتك أمام المرضى: متاح الآن لاستقبال الطلبات."
              : "حالتك أمام المرضى: غير متاح حاليًا."}
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-surface p-4 gap-3 mt-4">
          <Text className="text-base font-bold text-foreground">إضافة موعد محدد</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {WEEKDAYS.map((item) => {
              const selected = draft.day === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setDraft((current) => ({ ...current, day: item.key }))}
                  style={({ pressed }) => [
                    styles.dayChip,
                    selected ? styles.dayChipSelected : styles.dayChipNormal,
                    pressed && { transform: [{ scale: 0.96 }], opacity: 0.9 },
                  ]}
                >
                  <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View className="flex-row gap-2">
            <View className="flex-1 gap-1">
              <Text className="text-xs text-muted">من الساعة</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {TIME_SLOTS.filter((_, index) => index <= 20).map((hour) => {
                  const selected = draft.startHour === hour;
                  return (
                    <Pressable
                      key={`start-${hour}`}
                      onPress={() => setDraft((current) => ({ ...current, startHour: hour }))}
                      style={({ pressed }) => [
                        styles.hourChip,
                        selected ? styles.hourChipSelected : styles.hourChipNormal,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={[styles.hourChipText, selected && styles.hourChipTextSelected]}>
                        {hour}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1 gap-1">
              <Text className="text-xs text-muted">حتى الساعة</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {TIME_SLOTS.filter((_, index) => index >= 1).map((hour) => {
                  const selected = draft.endHour === hour;
                  return (
                    <Pressable
                      key={`end-${hour}`}
                      onPress={() => setDraft((current) => ({ ...current, endHour: hour }))}
                      style={({ pressed }) => [
                        styles.hourChip,
                        selected ? styles.hourChipSelected : styles.hourChipNormal,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={[styles.hourChipText, selected && styles.hourChipTextSelected]}>
                        {hour}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
          <Pressable
            onPress={addSlot}
            style={({ pressed }) => [styles.button, pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }]}
          >
            <Text style={styles.buttonText}>+ إضافة الموعد</Text>
          </Pressable>
          {hasAvailabilityErrors(pendingValidation) && (
            <Text style={styles.errorText}>تحقق من أوقات المواعيد المضافة.</Text>
          )}
        </View>

        <View className="rounded-2xl border border-border bg-surface p-4 gap-2 mt-4">
          <Text className="text-base font-bold text-foreground">
            جدولك الحالي ({availability.slots.length})
          </Text>
          {availability.slots.length === 0 ? (
            <Text className="text-sm text-muted">لم تضف مواعيد محددة بعد.</Text>
          ) : (
            WEEKDAYS.map((item) => {
              const slots = groupByDay.get(item.key);
              if (!slots || slots.length === 0) return null;
              return (
                <View key={item.key} className="gap-1.5 mt-1">
                  <Text className="text-sm font-semibold" style={styles.dayLabel}>{item.label}</Text>
                  {slots.map((slot, index) => (
                    <View key={`${slot.day}-${slot.startHour}-${index}`} className="flex-row items-center justify-between bg-background rounded-xl px-3 py-2 border border-border">
                      <Text className="text-sm text-foreground">
                        {slot.startHour}:00 – {slot.endHour}:00
                      </Text>
                      <Pressable
                        onPress={() => removeSlot(slot)}
                        style={({ pressed }) => [{ padding: 4 }, pressed && { opacity: 0.6 }]}
                      >
                        <Text style={styles.removeText}>حذف</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              );
            })
          )}
        </View>

        {saving && (
          <Text className="text-xs text-muted text-center mt-3">جارٍ الحفظ...</Text>
        )}

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  toggle: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  toggleOn: { backgroundColor: "#6B7B3F" },
  toggleOff: { backgroundColor: "#F3E9D2", borderWidth: 1, borderColor: "#C9A961" },
  toggleText: { fontSize: 12, fontWeight: "800", color: "#FFFDF8" },
  dayChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  dayChipNormal: { backgroundColor: "#FDFBF7", borderWidth: 1, borderColor: "#C9A961" },
  dayChipSelected: { backgroundColor: "#6B7B3F" },
  dayChipText: { color: "#8A6D2F", fontSize: 12, fontWeight: "700" },
  dayChipTextSelected: { color: "#FFFDF8" },
  dayLabel: { color: "#8A6D2F" },
  hourChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  hourChipNormal: { backgroundColor: "#FDFBF7", borderWidth: 1, borderColor: "#E4DCCB" },
  hourChipSelected: { backgroundColor: "#C9A961" },
  hourChipText: { color: "#6B7B3F", fontSize: 11, fontWeight: "700" },
  hourChipTextSelected: { color: "#FFFDF8" },
  errorText: { color: "#B55448", fontSize: 11, lineHeight: 16 },
  removeText: { color: "#B55448", fontSize: 12, fontWeight: "700" },
  button: {
    alignItems: "center",
    backgroundColor: "#6B7B3F",
    borderRadius: 999,
    paddingVertical: 12,
    marginTop: 2,
  },
  buttonText: { color: "#FFFDF8", fontSize: 14, fontWeight: "800" },
});
