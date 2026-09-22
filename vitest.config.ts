import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: {
    alias: {
      "react-native": "react-native-web",
      "react-native-svg": fileURLToPath(new URL("./tests/react-native-svg.mock.tsx", import.meta.url)),
      "lucide-react-native": fileURLToPath(new URL("./tests/lucide-react-native.mock.tsx", import.meta.url)),
      "react-native-keyboard-controller": fileURLToPath(new URL("./tests/react-native-keyboard-controller.mock.tsx", import.meta.url)),
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"], clearMocks: true, diff: { truncateThreshold: 20 } },
});
