export function optionalPositiveNumber(raw: string, label: string): number | undefined {
  if (!raw.trim()) return undefined;
  const number = Number(raw);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be a positive number or left blank.`);
  return number;
}
export function validateEntryRange(low?: number, high?: number) {
  for (const value of [low, high]) if (value !== undefined && (!Number.isFinite(value) || value <= 0)) throw new Error("Entry prices must be positive numbers.");
  if (low !== undefined && high !== undefined && low > high) throw new Error("Entry low must not exceed entry high.");
}
