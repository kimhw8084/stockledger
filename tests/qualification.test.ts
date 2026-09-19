import { expect, it } from "vitest";
import { percentile } from "../server/worker/qualification";

it("computes percentiles only from multiple actual samples", () => {
  expect(percentile([10], 0.5)).toBeNull();
  expect(percentile([10, 20, 30, 40], 0.5)).toBe(25);
  expect(percentile([10, 20, 30, 40], 0.95)).toBe(38.5);
});
