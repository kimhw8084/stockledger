import type { ActionPriority } from './contracts';

export interface MeasuredAction {
  key: string;
  priority: ActionPriority;
  width: number;
  order: number;
}

export interface ActionOverflowInput {
  availableWidth: number;
  actions: readonly MeasuredAction[];
  gap: number;
  overflowTriggerWidth: number;
}

export interface ActionOverflowResult {
  visibleKeys: string[];
  overflowKeys: string[];
  capacityExceeded: boolean;
  usedWidth: number;
}

function sanitize(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function rowWidth(actions: readonly MeasuredAction[], gap: number): number {
  if (actions.length === 0) return 0;
  return actions.reduce((sum, action) => sum + sanitize(action.width), 0) + sanitize(gap) * (actions.length - 1);
}

export function solveActionOverflow(input: ActionOverflowInput): ActionOverflowResult {
  const availableWidth = sanitize(input.availableWidth);
  const gap = sanitize(input.gap);
  const overflowTriggerWidth = sanitize(input.overflowTriggerWidth);
  const actions = [...input.actions]
    .filter((action) => action.key.length > 0)
    .map((action, index) => ({ ...action, order: Number.isFinite(action.order) ? action.order : index, width: sanitize(action.width) }));

  const byOriginalOrder = [...actions].sort((a, b) => a.order - b.order);
  const required = byOriginalOrder.filter((action) => action.priority === 'required');
  const preferred = byOriginalOrder.filter((action) => action.priority === 'preferred');
  const overflowPriority = byOriginalOrder.filter((action) => action.priority === 'overflow');
  const candidates = [...preferred, ...overflowPriority];

  const selected = new Set(required.map((action) => action.key));
  const requiredWidth = rowWidth(required, gap);
  const minimumTriggerCost = candidates.length > 0 ? overflowTriggerWidth + (required.length > 0 ? gap : 0) : 0;
  const capacityExceeded = requiredWidth > availableWidth || requiredWidth + minimumTriggerCost > availableWidth;

  const attemptTier = (tier: readonly MeasuredAction[]) => {
    for (const candidate of tier) {
      const tentative = byOriginalOrder.filter((action) => selected.has(action.key) || action.key === candidate.key);
      const hiddenCount = actions.length - tentative.length;
      const contentWidth = rowWidth(tentative, gap);
      const triggerCost = hiddenCount > 0 ? overflowTriggerWidth + (tentative.length > 0 ? gap : 0) : 0;
      if (contentWidth + triggerCost <= availableWidth) selected.add(candidate.key);
    }
  };

  if (!capacityExceeded) {
    attemptTier(preferred);
    const allPreferredVisible = preferred.every((action) => selected.has(action.key));
    if (allPreferredVisible) attemptTier(overflowPriority);
  }

  const visible = byOriginalOrder.filter((action) => selected.has(action.key));
  const overflow = byOriginalOrder.filter((action) => !selected.has(action.key));
  const usedWidth = rowWidth(visible, gap) + (overflow.length > 0 ? overflowTriggerWidth + (visible.length > 0 ? gap : 0) : 0);

  return {
    visibleKeys: visible.map((action) => action.key),
    overflowKeys: overflow.map((action) => action.key),
    capacityExceeded,
    usedWidth,
  };
}
