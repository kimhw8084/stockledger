import type { BreakpointName } from '@expo-base/tokens';

export interface CapabilityThresholds {
  compact: number;
  medium: number;
  expanded: number;
  wide: number;
}

export interface VisibilityRange {
  from?: BreakpointName;
  until?: BreakpointName;
}

export const breakpointOrder: readonly BreakpointName[] = ['compact', 'medium', 'expanded', 'wide'];

export function capabilityForWidth(width: number, thresholds: CapabilityThresholds): BreakpointName {
  if (!Number.isFinite(width) || width < 0) return 'compact';
  if (width >= thresholds.wide) return 'wide';
  if (width >= thresholds.expanded) return 'expanded';
  if (width >= thresholds.medium) return 'medium';
  return 'compact';
}

export function isCapabilityVisible(capability: BreakpointName, range: VisibilityRange): boolean {
  const current = breakpointOrder.indexOf(capability);
  const from = range.from ? breakpointOrder.indexOf(range.from) : 0;
  const until = range.until ? breakpointOrder.indexOf(range.until) : breakpointOrder.length;
  return current >= from && current < until;
}
