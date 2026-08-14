import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { getSessionAccount } from "@/lib/provider-auth";

export default function EntryScreen() {
  useEffect(() => {
    getSessionAccount().then((account) => {
      router.replace((account ? "/(tabs)" : "/login") as never);
    });
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator color="#6B7B3F" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", backgroundColor: "#F5F0E6", flex: 1, justifyContent: "center" },
});
