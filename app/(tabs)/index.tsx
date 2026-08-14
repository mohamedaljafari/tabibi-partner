import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";

import { useCallback } from "react";

import { ScreenContainer } from "@/components/screen-container";
import {
  getSessionAccount,
  signOutProvider,
  STATUS_LABELS,
} from "@/lib/provider-auth";
import type { ProviderAccount } from "@/lib/provider-auth";
import { getProviderRatingSummary, type RatingSummary } from "@/lib/ratings";

export default function ProfileScreen() {
  const [account, setAccount] = useState<ProviderAccount | null>(null);
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    void getSessionAccount().then((current) => {
      if (!current) {
        router.replace("/login" as never);
        return;
      }
      setAccount(current);
      void getProviderRatingSummary(current.id).then(setSummary);
    });
  };

  useFocusEffect(useCallback(refresh, []));
  useEffect(() => {
    refresh();
  }, []);

  const handleSignOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signOutProvider();
      router.replace("/login" as never);
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = STATUS_LABELS[account?.status ?? "pending"] ?? "قيد المراجعة";
  const isVerified = account?.status === "active";

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 32 }}>
        <View className="items-center gap-2 mt-2">
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {account?.fullName ? account.fullName.charAt(0) : "?"}
            </Text>
          </View>
          <Text className="text-2xl font-bold text-foreground text-center">{account?.fullName}</Text>
          <Text className="text-sm text-muted">{account?.role}</Text>
          <View style={[styles.statusBadge, isVerified ? styles.badgeVerified : styles.badgePending]}>
            <Text style={[styles.badgeText, isVerified && styles.badgeTextVerified]}>
              {isVerified ? "✓ موثّق" : `⏳ ${statusLabel}`}
            </Text>
          </View>
          {!isVerified && (
            <Text className="text-xs text-muted text-center leading-5">
              مستنداتك قيد المراجعة من الإدارة. ستتفاعل طلبات المرضى فور تفعيل حسابك.
            </Text>
          )}
          {summary && summary.count > 0 && (
            <View className="flex-row items-center gap-1 mt-1">
              <Text style={styles.star}>★</Text>
              <Text className="text-sm font-bold text-foreground">
                {summary.average.toFixed(1)}
              </Text>
              <Text className="text-xs text-muted">({summary.count} تقييم)</Text>
            </View>
          )}
        </View>

        <View className="gap-4 mt-6">
          <View className="rounded-2xl border border-border bg-surface p-4 gap-3">
            <Text className="text-base font-bold text-foreground">نبذة عنك</Text>
            <Text className="text-sm text-muted leading-6">
              {account?.bio?.trim() ? account.bio : "لم تضف نبذة بعد."}
            </Text>
            <Text className="text-sm text-muted leading-6">
              {account && account.yearsOfExperience > 0
                ? `سنوات الخبرة: ${account.yearsOfExperience}+`
                : "سنوات الخبرة: غير محدد"}
            </Text>
          </View>

          <View className="rounded-2xl border border-border bg-surface p-4 gap-3">
            <Text className="text-base font-bold text-foreground">تخصصاتك</Text>
            {account?.specializations && account.specializations.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                {account.specializations.map((spec) => (
                  <View key={spec} style={styles.chip}>
                    <Text style={styles.chipText}>{spec}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="text-sm text-muted">لم تحدد تخصصاتك بعد.</Text>
            )}
          </View>

          <View className="rounded-2xl border border-border bg-surface p-4 gap-3">
            <Text className="text-base font-bold text-foreground">خدماتك</Text>
            {account?.services && account.services.length > 0 ? (
              account.services.map((service) => (
                <View key={service.id} className="flex-row items-center justify-between">
                  <Text className="text-sm text-foreground flex-1">{service.name}</Text>
                  <Text className="text-sm font-bold" style={styles.priceText}>
                    {service.price} د.ل
                    {service.durationMinutes ? ` · ${service.durationMinutes} دقيقة` : ""}
                  </Text>
                </View>
              ))
            ) : (
              <Text className="text-sm text-muted">لم تُضف خدماتك بعد. اذهب لتبويب الخدمات.</Text>
            )}
          </View>

          <Pressable
            onPress={handleSignOut}
            disabled={busy}
            style={({ pressed }) => [
              styles.button,
              pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
              busy && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.buttonText}>{busy ? "جارٍ الخروج..." : "تسجيل الخروج"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    backgroundColor: "#6B7B3F",
    borderRadius: 44,
    height: 72,
    justifyContent: "center",
    width: 72,
    marginTop: 8,
  },
  avatarText: { color: "#FFFDF8", fontSize: 28, fontWeight: "800" },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  badgePending: { backgroundColor: "#F3E9D2", borderWidth: 1, borderColor: "#C9A961" },
  badgeVerified: { backgroundColor: "#6B7B3F" },
  badgeText: { color: "#8A6D2F", fontSize: 12, fontWeight: "700" },
  badgeTextVerified: { color: "#FFFDF8" },
  star: { color: "#C9A961", fontSize: 16 },
  priceText: { color: "#6B7B3F" },
  chip: {
    backgroundColor: "#F3E9D2",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#C9A961",
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: { color: "#8A6D2F", fontSize: 12, fontWeight: "700" },
  button: {
    alignItems: "center",
    backgroundColor: "#FFFDF8",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#B55448",
    paddingVertical: 14,
    marginTop: 4,
  },
  buttonText: { color: "#B55448", fontSize: 15, fontWeight: "800" },
});
