import React from "react";
import { renderToString } from "react-dom/server";
import { expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ model: {} as any }));
vi.mock("../src/hooks/useAppModel", () => ({ useAppModel: () => fixture.model }));
vi.mock("expo-status-bar", () => ({ StatusBar: () => null }));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaProvider: ({ children }: any) => children, SafeAreaView: ({ children }: any) => children, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
import App from "../App";
import { createEmptyAppData } from "../src/lib/storage";
import { seedData } from "../src/lib/seed";
const render = (data: any, error: string | null = null) => {
  fixture.model = { data, error, loading: false, saving: false, scanning: false, providerHealth: [], providerHealthLoading: false, actions: {} };
  return renderToString(<App />);
};
it("renders a useful first-run workspace without any sample prices", () => {
  expect(render(createEmptyAppData())).toContain("Add your first stock");
});
it("renders recovery instead of an endless loading screen", () => {
  expect(render(null, "Saved data needs recovery")).toContain("Export recovery copy");
});
it("renders the preserved prototype workspace", () => {
  expect(render(seedData)).toContain("Sample data is present");
});
