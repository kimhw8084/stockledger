import { describe, expect, it } from "vitest";
import {
  formatLocaleDate,
  formatLocaleDateTime,
  formatLocaleNumber,
  getMissingTranslationKeys,
  hasTranslation,
  t,
} from "../src/lib/i18n";

describe("production localization catalog", () => {
  it("keeps English and Korean catalogs complete", () => {
    expect(getMissingTranslationKeys()).toEqual({ en: [], ko: [] });
  });

  it("falls back to English for a missing locale entry and to the key for unknown copy", () => {
    expect(t("ko", "common.done")).toBe("닫기");
    expect(t("ko", "common.loading")).toBe("StockLedger 불러오는 중...");
    expect(t("ko", "common.notInCatalog")).toBe("common.notInCatalog");
    expect(t("fr" as any, "common.done")).toBe("Done");
    expect(hasTranslation("ko", "common.done")).toBe(true);
    expect(hasTranslation("ko", "common.notInCatalog")).toBe(false);
  });

  it("formats dates, times, and numbers using the selected locale", () => {
    const date = "2025-01-15T13:05:00.000Z";
    expect(formatLocaleNumber("en", 1234567.89)).toBe("1,234,567.89");
    expect(formatLocaleNumber("ko", 1234567.89)).toBe("1,234,567.89");
    expect(formatLocaleDate("en", date)).toContain("Jan");
    expect(formatLocaleDate("ko", date)).toContain("1월");
    expect(formatLocaleDate("en", "2025-01-15")).toContain("15");
    expect(formatLocaleDateTime("en", date)).toContain("Jan");
    expect(formatLocaleDateTime("ko", date)).toContain("1월");
    expect(formatLocaleDate("en", "not-a-date")).toBe("not-a-date");
  });
});
