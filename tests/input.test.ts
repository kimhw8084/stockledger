import { expect, it } from "vitest";
import { optionalPositiveNumber, validateEntryRange } from "../src/domain/inputValidation";
it("keeps blank entry prices unknown and rejects nonfinite or reversed ranges", () => {
  expect(optionalPositiveNumber(" ", "Price")).toBeUndefined();
  expect(optionalPositiveNumber("12.50", "Price")).toBe(12.5);
  for (const text of ["0", "-1", "Infinity", "abc"]) expect(() => optionalPositiveNumber(text, "Price")).toThrow();
  expect(() => validateEntryRange(20, 10)).toThrow(/low/);
});
