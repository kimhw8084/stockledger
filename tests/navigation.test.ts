import { describe, expect, it } from "vitest";
import { parseWorkspaceRoute, workspaceHash } from "../src/hooks/useWorkspaceNavigation";

describe("workspace deep-link routes", () => {
  it("round-trips stable entity parameters with deterministic ordering", () => {
    const hash = workspaceHash("Stocks", { stockId: "stock-1", metricId: "metric 1" });
    expect(hash).toBe("#/watchlist?metricId=metric+1&stockId=stock-1");
    expect(parseWorkspaceRoute(hash)).toEqual({
      tab: "Stocks",
      params: { metricId: "metric 1", stockId: "stock-1" },
    });
  });

  it("preserves an ordinary section route without entity parameters", () => {
    expect(parseWorkspaceRoute("#/journal")).toEqual({ tab: "Journal", params: {} });
    expect(workspaceHash("Journal")).toBe("#/journal");
  });
});
