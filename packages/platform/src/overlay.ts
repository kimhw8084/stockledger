import type { OverlayPlacement } from './contracts';
export type AnchoredOverlayPlacement = Extract<OverlayPlacement, 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'>;
export interface Rect { x: number; y: number; width: number; height: number; }
export interface Viewport { width: number; height: number; }
export interface Insets { top: number; right: number; bottom: number; left: number; }
export interface OverlayPlacementInput {
  anchor: Rect;
  overlay: { width: number; height: number };
  viewport: Viewport;
  insets?: Insets;
  preferred?: AnchoredOverlayPlacement;
  gap?: number;
  margin?: number;
  direction?: 'ltr' | 'rtl';
}
export interface OverlayPlacementResult {
  x: number;
  y: number;
  maxWidth: number;
  maxHeight: number;
  placement: AnchoredOverlayPlacement;
  constrained: boolean;
}

const zeroInsets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));
const isBottom = (placement: AnchoredOverlayPlacement) => placement.startsWith('bottom');
const isEnd = (placement: AnchoredOverlayPlacement, direction: 'ltr' | 'rtl') => direction === 'rtl' ? placement.endsWith('-start') : placement.endsWith('-end');
const flipVertical = (placement: AnchoredOverlayPlacement): AnchoredOverlayPlacement => placement === 'bottom-start' ? 'top-start' : placement === 'bottom-end' ? 'top-end' : placement === 'top-start' ? 'bottom-start' : 'bottom-end';

export function solveAnchoredOverlay(input: OverlayPlacementInput): OverlayPlacementResult {
  const insets = input.insets ?? zeroInsets;
  const preferred = input.preferred ?? 'bottom-start';
  const gap = Math.max(0, input.gap ?? 8);
  const margin = Math.max(0, input.margin ?? 8);
  const direction = input.direction ?? 'ltr';
  const left = insets.left + margin;
  const right = input.viewport.width - insets.right - margin;
  const top = insets.top + margin;
  const bottom = input.viewport.height - insets.bottom - margin;
  const maxWidth = Math.max(0, right - left);
  const anchorBottom = input.anchor.y + input.anchor.height;
  const anchorRight = input.anchor.x + input.anchor.width;

  const availableFor = (placement: AnchoredOverlayPlacement) => isBottom(placement)
    ? Math.max(0, bottom - (anchorBottom + gap))
    : Math.max(0, input.anchor.y - gap - top);

  const fits = (placement: AnchoredOverlayPlacement) => input.overlay.width <= maxWidth && input.overlay.height <= availableFor(placement);
  const flipped = flipVertical(preferred);
  let placement = fits(preferred) ? preferred : fits(flipped) ? flipped : availableFor(preferred) >= availableFor(flipped) ? preferred : flipped;
  const maxHeight = availableFor(placement);
  const renderedWidth = Math.min(input.overlay.width, maxWidth);
  const renderedHeight = Math.min(input.overlay.height, maxHeight);
  const desiredX = isEnd(placement, direction) ? anchorRight - renderedWidth : input.anchor.x;
  const x = clamp(desiredX, left, right - renderedWidth);
  const y = isBottom(placement)
    ? clamp(anchorBottom + gap, top, bottom - renderedHeight)
    : clamp(input.anchor.y - gap - renderedHeight, top, bottom - renderedHeight);
  const constrained = renderedWidth < input.overlay.width || renderedHeight < input.overlay.height || placement !== preferred || x !== desiredX;
  return { x, y, maxWidth, maxHeight, placement, constrained };
}
