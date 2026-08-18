import { defineConfig } from "vitest/config";
import path from "path";
import "dotenv/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/vitest-setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "expo-crypto": require.resolve("./tests/__mocks__/expo-crypto.ts"),
      "react-native": require.resolve("./tests/__mocks__/react-native.ts"),
    },
  },
});
