import { defineConfig } from "vitest/config";
import path from "path";
import "dotenv/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/vitest-setup.ts"],
    deps: {
      // Expo runtime modules are mocked via resolve.alias (tests/__mocks__/),
      // so they must not be bundled/inlined by Vite during test transforms.
      optimizer: {
        web: { enabled: false },
        ssr: { enabled: false },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "expo-crypto": path.resolve(__dirname, "tests/__mocks__/expo-crypto.ts"),
      "react-native": path.resolve(__dirname, "tests/__mocks__/react-native.ts"),
      "expo-modules-core": path.resolve(__dirname, "tests/__mocks__/expo-modules-core.cjs"),
      "expo-random": path.resolve(__dirname, "tests/__mocks__/expo-random.cjs"),
      "expo": path.resolve(__dirname, "tests/__mocks__/expo-modules-core.cjs"),
    },
  },
});
