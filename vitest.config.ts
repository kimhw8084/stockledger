import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: { "react-native": "react-native-web" } },
  test: { environment: "node", include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"], clearMocks: true, diff: { truncateThreshold: 20 } },
});
