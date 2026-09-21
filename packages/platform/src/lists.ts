export const listDefaults = {
  staticItemLimit: 40,
  pageSize: 50,
  minimumPageSize: 10,
  maximumPageSize: 200,
} as const;

export interface ListKeyValidationResult { valid: boolean; duplicates: string[]; emptyKeys: number[]; }

export function shouldUseVirtualizedList(itemCount: number, staticLimit = listDefaults.staticItemLimit): boolean {
  return Math.max(0, Math.trunc(itemCount)) > Math.max(0, Math.trunc(staticLimit));
}

export function normalizePageSize(value: number): number {
  if (!Number.isFinite(value)) return listDefaults.pageSize;
  return Math.min(listDefaults.maximumPageSize, Math.max(listDefaults.minimumPageSize, Math.trunc(value)));
}

export function validateListKeys(keys: readonly string[]): ListKeyValidationResult {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const emptyKeys: number[] = [];
  keys.forEach((raw, index) => {
    const key = raw.trim();
    if (!key) emptyKeys.push(index);
    else if (seen.has(key)) duplicates.add(key);
    else seen.add(key);
  });
  return { valid: duplicates.size === 0 && emptyKeys.length === 0, duplicates: [...duplicates].sort(), emptyKeys };
}
