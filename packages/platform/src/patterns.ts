export const GOLDEN_PATTERN_IDS = [
  'dashboard',
  'feed-list',
  'search-results',
  'data-workspace',
  'detail',
  'master-detail',
  'create-edit-form',
  'wizard',
  'settings',
  'profile',
  'authentication',
  'analytics',
  'empty-start',
  'full-screen-workflow',
  'overlay-workflow',
] as const;
export type GoldenPatternId = typeof GOLDEN_PATTERN_IDS[number];

export function validateGoldenPatternCatalog(ids: readonly string[]): { valid: boolean; duplicates: string[]; empty: number[] } {
  const seen = new Set<string>(); const duplicates = new Set<string>(); const empty: number[] = [];
  ids.forEach((raw,index)=>{const id=raw.trim();if(!id){empty.push(index);return;}if(seen.has(id))duplicates.add(id);seen.add(id);});
  return {valid:duplicates.size===0&&empty.length===0,duplicates:[...duplicates],empty};
}
