import { expect, it } from "vitest";
import { mergeWatchlist, parseWatchlistCsv } from "../src/domain/watchlistImport";
import { reviewReport } from "../src/domain/reviewReport";
import { createEmptyAppData } from "../src/lib/storage";
it("previews imports, preserves existing authored notes, and creates unavailable coverage", () => {
  const rows = parseWatchlistCsv('Ticker,Company,Notes\nAAPL,Apple,"Review, do not assume"\nMSFT,Microsoft,Watch revenue');
  const original = mergeWatchlist(createEmptyAppData(), rows.slice(0,1));
  const next = mergeWatchlist(original, [{ ...rows[0], thesis: "Replacement" }, rows[1]]);
  expect(next.stocks).toHaveLength(2); expect(next.stocks[0].thesis).toBe("Review, do not assume");
  expect(next.snapshots.every(snapshot => !snapshot.isMock && snapshot.freshness === "Unavailable")).toBe(true);
  expect(() => parseWatchlistCsv("Symbol\nAAPL\naapl")).toThrow(/twice/);
});
it("generates an honest weekly report without inventing returns or missing observations", () => {
  const data = mergeWatchlist(createEmptyAppData(), [{ symbol: "AAPL", name: "Apple", thesis: "Review" }]);
  const report = reviewReport(data, new Date("2026-09-15T22:00:00Z"));
  expect(report).toContain("No decisions recorded"); expect(report).toContain("AAPL: Unavailable; observed not verified");
  expect(report).not.toContain("$0");
});
