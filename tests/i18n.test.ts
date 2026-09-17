import { describe, expect, it } from "vitest";
import {
  formatLocaleDate,
  formatLocaleDateTime,
  formatLocaleNumber,
  getMissingTranslationKeys,
  hasTranslation,
  localizedScannerDescription,
  localizedScannerStatus,
  localizedSetupStrength,
  recipeConditionMapCopy,
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

  it("uses translated presentation copy for the review matrix and scanner UI", () => {
    const korean = recipeConditionMapCopy("ko");
    expect(korean.passed).toBe("충족");
    expect(korean.failed).toBe("미충족");
    expect(korean.warnings).toBe("경고");
    expect(korean.blockers).toBe("차단");
    expect(korean.support).toBe("근거");
    expect(korean.risks).toBe("위험");
    expect(korean.state("변경됨")).toBe("상태: 변경됨");
    expect(korean.urgency("Attention Needed")).toBe("긴급도: 즉시 확인");
    expect(korean.nextTrigger("price support")).toBe("다음 트리거: price support");
    expect(korean.showMatrix).toBe("매트릭스 보기");
    expect(korean.hideMatrix).toBe("매트릭스 숨기기");
    expect(korean.condition).toBe("조건");
    expect(localizedSetupStrength("ko", "High")).toBe("높음");
    expect(localizedScannerStatus("ko", "BLOCKED_OR_INCOMPLETE_DATA")).toBe("차단");
    expect(localizedScannerDescription("ko", "MATCHED")).toContain("조건이 일치했습니다");

    const english = recipeConditionMapCopy("en");
    expect(english.passed).toBe("Passed");
    expect(english.state("Changed")).toBe("State: Changed");
    expect(english.showMatrix).toBe("Show matrix");
    expect(localizedScannerStatus("en", "NEAR_MATCH")).toBe("Near");
    expect(localizedScannerDescription("en", "BLOCKED_OR_INCOMPLETE_DATA")).toContain("Scan blocked");
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
