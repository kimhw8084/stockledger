import type { BreakpointName, ControlSize } from '@expo-base/tokens';

export type Density = 'comfortable' | 'compact';
export type ColorSchemePreference = 'system' | 'light' | 'dark';
export type InteractionState = 'rest' | 'hover' | 'focusVisible' | 'pressed' | 'selected' | 'disabled' | 'loading' | 'error';
export type ActionPriority = 'required' | 'preferred' | 'overflow';
export type OverlayLayer = 'dropdown' | 'popover' | 'sheet' | 'modal' | 'toast';
export type OverlayPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'left' | 'right';
export type ScrollOwner = 'screen' | 'list' | 'form' | 'internal';

export interface ResponsiveVisibility {
  from?: BreakpointName;
  until?: BreakpointName;
}

export interface InteractiveContract {
  minimumTarget: ControlSize;
  keyboardAccessible: boolean;
  requiresAccessibleLabelWhenIconOnly: true;
}

export const defaultInteractiveContract: InteractiveContract = {
  minimumTarget: 'md',
  keyboardAccessible: true,
  requiresAccessibleLabelWhenIconOnly: true,
};

export const layoutRules = {
  onePrimaryVerticalScrollOwner: true,
  horizontalPageOverflowAllowed: false,
  featureAbsolutePositioningAllowed: false,
  featureManualZIndexAllowed: false,
  semanticSpacingOnly: true,
} as const;
