import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("R11 Expo Base foundation", () => {
  it("records the exact pinned source and selected closure", () => {
    const provenance = JSON.parse(read(".expo-base/source.json")) as {
      sourceCommit: string;
      sourceTree: string;
      selectedRoots: string[];
      internalPackageClosure: string[];
    };

    expect(provenance.sourceCommit).toBe("743a8bbf8273f663503dc8dd398135806dccb386");
    expect(provenance.sourceTree).toBe("2fda05146dabea9bd44756f7c8071228166d40c8");
    expect(provenance.selectedRoots).toEqual([
      "@expo-base/accessibility",
      "@expo-base/components",
      "@expo-base/feedback",
      "@expo-base/layouts",
    ]);
    expect(provenance.internalPackageClosure).toEqual([
      "@expo-base/accessibility",
      "@expo-base/components",
      "@expo-base/feedback",
      "@expo-base/i18n",
      "@expo-base/icons",
      "@expo-base/layouts",
      "@expo-base/media-presentation",
      "@expo-base/platform",
      "@expo-base/primitives",
      "@expo-base/tokens",
    ]);
  });

  it("vendors every internal package in the recorded closure without source-workspace paths", () => {
    const provenance = JSON.parse(read(".expo-base/source.json")) as { internalPackageClosure: string[] };
    const closure = new Set(provenance.internalPackageClosure);

    for (const packageName of closure) {
      const packagePath = `packages/${packageName.replace("@expo-base/", "")}`;
      expect(existsSync(resolve(root, packagePath, "package.json"))).toBe(true);
      const manifest = JSON.parse(read(`${packagePath}/package.json`)) as Record<string, Record<string, string> | undefined>;
      for (const dependencyField of ["dependencies", "optionalDependencies", "peerDependencies"]) {
        for (const [dependency, version] of Object.entries(manifest[dependencyField] ?? {})) {
          expect(version).not.toMatch(/^(file:|workspace:)/);
          if (dependency.startsWith("@expo-base/")) expect(closure.has(dependency)).toBe(true);
        }
      }
    }
  });
});

describe("R11 shell and Today boundaries", () => {
  it("keeps the new route on the StockLedger UI facade", () => {
    const today = read("src/features/today/TodayScreen.tsx");
    const shell = read("src/features/shell/StockLedgerShell.tsx");

    for (const source of [today, shell]) {
      expect(source).not.toContain("../styles");
      expect(source).not.toContain("components/common");
      expect(source).not.toContain("HomeVisualDashboard");
    }
    expect(existsSync(resolve(root, "src/components/BottomNav.tsx"))).toBe(false);
    expect(existsSync(resolve(root, "src/components/HomeVisualDashboard.tsx"))).toBe(false);
    expect(shell).toContain('accessibilityRole="tablist"');
    expect(shell).toContain('key: "Home"');
    expect(shell).toContain('key: "Stocks"');
    expect(shell).toContain('key: "Logic Lab"');
    expect(shell).toContain('key: "Journal"');
    expect(shell).toContain("props.tabLabels.Settings");
    expect(today).toContain("No auto-trading · no outcome guarantee");
    expect(today).toContain("WindowPanel");
    expect(today).toContain("Record review");
  });

  it("registers the StockLedger semantic light/dark pair with Unistyles", () => {
    const unistyles = read("src/ui/unistyles.ts");
    const brand = read("src/ui/brand.ts");
    expect(unistyles).toContain("StyleSheet.configure");
    expect(unistyles).toContain('initialTheme: "light"');
    expect(brand).toContain("light:");
    expect(brand).toContain("dark:");
  });
});
