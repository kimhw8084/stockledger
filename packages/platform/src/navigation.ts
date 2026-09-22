export interface NavigationContractItem {
  key: string;
  label: string;
  href?: string;
}

export interface NavigationContractResult {
  valid: boolean;
  violations: string[];
}

export function validatePrimaryNavigation(items: readonly NavigationContractItem[]): NavigationContractResult {
  const violations: string[] = [];
  if (items.length < 3) violations.push('Primary navigation should contain at least 3 destinations.');
  if (items.length > 5) violations.push('Primary compact navigation may contain at most 5 destinations.');
  const keys = new Set<string>();
  for (const item of items) {
    if (!item.key.trim()) violations.push('Navigation keys must be non-empty.');
    if (!item.label.trim()) violations.push(`Navigation item "${item.key}" must have a visible label.`);
    if (keys.has(item.key)) violations.push(`Duplicate navigation key: ${item.key}`);
    keys.add(item.key);
  }
  return { valid: violations.length === 0, violations };
}

export function bestNavigationMatch(pathname: string, items: readonly NavigationContractItem[]): string | null {
  const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  const candidates = items
    .filter((item) => item.href)
    .map((item) => ({ ...item, normalizedHref: item.href === '/' ? '/' : item.href!.replace(/\/+$/, '') }))
    .filter((item) => normalizedPath === item.normalizedHref || (item.normalizedHref !== '/' && normalizedPath.startsWith(`${item.normalizedHref}/`)))
    .sort((a, b) => b.normalizedHref.length - a.normalizedHref.length);
  return candidates[0]?.key ?? null;
}

export type RovingFocusOrientation = 'horizontal' | 'vertical' | 'both';

export interface RovingFocusOptions {
  orientation?: RovingFocusOrientation;
  direction?: 'ltr' | 'rtl';
  wrap?: boolean;
}

/** Returns the enabled item targeted by a composite-widget navigation key. */
export function resolveRovingFocusIndex(
  key: string,
  currentIndex: number,
  enabled: readonly boolean[],
  { orientation = 'horizontal', direction = 'ltr', wrap = true }: RovingFocusOptions = {},
): number | null {
  const enabledIndices = enabled.flatMap((value, index) => value ? [index] : []);
  if (enabledIndices.length === 0) return null;
  if (key === 'Home') return enabledIndices[0] ?? null;
  if (key === 'End') return enabledIndices.at(-1) ?? null;

  let delta = 0;
  if ((orientation === 'horizontal' || orientation === 'both') && key === 'ArrowRight') delta = direction === 'rtl' ? -1 : 1;
  else if ((orientation === 'horizontal' || orientation === 'both') && key === 'ArrowLeft') delta = direction === 'rtl' ? 1 : -1;
  else if ((orientation === 'vertical' || orientation === 'both') && key === 'ArrowDown') delta = 1;
  else if ((orientation === 'vertical' || orientation === 'both') && key === 'ArrowUp') delta = -1;
  else return null;

  const position = enabledIndices.indexOf(currentIndex);
  const startingPosition = position >= 0 ? position : delta > 0 ? -1 : enabledIndices.length;
  const nextPosition = startingPosition + delta;
  if (wrap) return enabledIndices[(nextPosition + enabledIndices.length) % enabledIndices.length] ?? null;
  return enabledIndices[Math.min(enabledIndices.length - 1, Math.max(0, nextPosition))] ?? null;
}
