import { defineConfig } from "vitest/config";
import "dotenv/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "expo-crypto": require.resolve("./tests/__mocks__/expo-crypto.ts"),
    },
  },
});
