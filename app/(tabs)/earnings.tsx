import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { getSessionAccount } from "@/lib/provider-auth";
import {
  getWalletSummary,
  type WalletSummary,
} from "@/lib/wallets";

const TYPE_LABELS: Record<string, string> = {
  earned: "مستحق له",
  charge: "مستحق عليه",
};

const KIND_STYLES: Record<string, { color: string }> = {
  credit: { color: "#6B7B3F" },
  debit: { color: "#B55448" },
};

export default function EarningsScreen() {
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);

  const reload = () => {
    void getSessionAccount().then((account) => {
      if (!account) return;
      setAccountName(account.fullName);
      void getWalletSummary(account.id).then(setSummary);
    });
  };

  useFocusEffect(useCallback(reload, []));

  const entries = summary?.entries ?? [];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 32 }}>
        <View className="gap-2 mt-2 mb-4">
          <Text className="text-2xl font-bold text-foreground">أرباحك</Text>
          <Text className="text-sm text-muted leading-6">
            سجل محاسبي بالمبالغ المستحقة لك، دون أي دفعات فعلية حتى تفعيل بوابات الدفع.
          </Text>
        </View>

        <View className="rounded-2xl border border-border bg-surface p-4 gap-2">
          <Text className="text-sm text-muted">{accountName ?? "—"}</Text>
          <Text className="text-3xl font-bold" style={styles.balanceText}>
            {summary ? `${summary.balance.toFixed(2)} د.ل` : "0.00 د.ل"}
          </Text>
          <View className="flex-row gap-4 mt-1">
            <View className="gap-1 flex-1">
              <Text className="text-xs text-muted">إجمالي المستحق لك</Text>
              <Text style={styles.creditText}>
                {summary ? `${summary.credit.toFixed(2)} د.ل` : "0.00 د.ل"}
              </Text>
            </View>
            <View className="gap-1 flex-1">
              <Text className="text-xs text-muted">إجمالي المستحق عليك</Text>
              <Text style={styles.debitText}>
                {summary ? `${summary.debit.toFixed(2)} د.ل` : "0.00 د.ل"}
              </Text>
            </View>
          </View>
        </View>

        <Text className="text-base font-bold text-foreground mt-6 mb-3">
          سجل القيود ({entries.length})
        </Text>

        {entries.length === 0 ? (
          <View className="items-center rounded-2xl border border-border bg-surface p-8 gap-3">
            <Text className="text-base font-semibold text-foreground">لا توجد قيود بعد</Text>
            <Text className="text-sm text-muted text-center leading-6">
              تظهر هنا القيود عند إتمام خدمة، حيث يُسجّل المبلغ كمستحق لك.
            </Text>
          </View>
        ) : (
          entries.map((entry) => (
            <View
              key={entry.id}
              className="flex-row items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 mb-2"
            >
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-semibold text-foreground">
                  {TYPE_LABELS[entry.type] ?? entry.type}
                </Text>
                <Text className="text-xs text-muted leading-5" numberOfLines={2}>
                  {entry.description}
                </Text>
                <Text className="text-[10px] text-muted">
                  {new Date(entry.createdAt).toLocaleString("ar-LY")}
                </Text>
              </View>
              <Text
                className="text-base font-bold"
                style={KIND_STYLES[entry.kind] ?? { color: "#6B7B3F" }}
              >
                {entry.kind === "credit" ? "+" : "−"}{entry.amount.toFixed(2)} د.ل
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  balanceText: { color: "#6B7B3F" },
  creditText: { color: "#6B7B3F", fontSize: 16, fontWeight: "800" },
  debitText: { color: "#B55448", fontSize: 16, fontWeight: "800" },
});
