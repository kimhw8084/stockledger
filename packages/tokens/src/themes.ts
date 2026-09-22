import type { ExpoBaseColors } from './colors';
import { darkColors, lightColors } from './colors';
import { applyBrandAccent, brandPresets, type ExpoBaseBrand } from './brand';
import { componentMetrics, contentWidths, controlHeights, feedbackMetrics, feedbackTiming, formMetrics, iconSizes, interactionFeedback, layers, motion, radii, spacing, strokeWidths, typography, typographyMetrics, visualizationMetrics } from './foundations';
import { actionMetrics, layoutDimensions } from './layout';

export interface ExpoBaseTheme {
  spacing: typeof spacing;
  radii: typeof radii;
  strokeWidths: typeof strokeWidths;
  controlHeights: typeof controlHeights;
  iconSizes: typeof iconSizes;
  contentWidths: typeof contentWidths;
  layers: typeof layers;
  motion: typeof motion;
  typography: typeof typography;
  typographyMetrics: typeof typographyMetrics;
  interactionFeedback: typeof interactionFeedback;
  formMetrics: typeof formMetrics;
  componentMetrics: typeof componentMetrics;
  feedbackTiming: typeof feedbackTiming;
  feedbackMetrics: typeof feedbackMetrics;
  visualizationMetrics: typeof visualizationMetrics;
  layoutDimensions: typeof layoutDimensions;
  actionMetrics: typeof actionMetrics;
  colors: ExpoBaseColors;
  elevation: {
    none: { boxShadow: string };
    low: { boxShadow: string };
    medium: { boxShadow: string };
    high: { boxShadow: string };
  };
}

const geometry = {
  spacing,
  radii,
  strokeWidths,
  controlHeights,
  iconSizes,
  contentWidths,
  layers,
  motion,
  typography,
  typographyMetrics,
  interactionFeedback,
  formMetrics,
  componentMetrics,
  feedbackTiming,
  feedbackMetrics,
  visualizationMetrics,
  layoutDimensions,
  actionMetrics,
} as const;

export const lightTheme = {
  ...geometry,
  colors: lightColors,
  elevation: {
    none: { boxShadow: 'none' },
    low: { boxShadow: '0 1px 2px rgba(14,18,22,0.05)' },
    medium: { boxShadow: '0 10px 28px rgba(14,18,22,0.08)' },
    high: { boxShadow: '0 18px 48px rgba(14,18,22,0.13)' },
  },
} satisfies ExpoBaseTheme;

export const darkTheme = {
  ...geometry,
  colors: darkColors,
  elevation: {
    none: { boxShadow: 'none' },
    low: { boxShadow: '0 1px 1px rgba(0,0,0,0.24)' },
    medium: { boxShadow: '0 12px 30px rgba(0,0,0,0.30)' },
    high: { boxShadow: '0 20px 52px rgba(0,0,0,0.40)' },
  },
} satisfies ExpoBaseTheme;

export function createExpoBaseThemes(brand: ExpoBaseBrand) {
  return {
    light: { ...lightTheme, colors: applyBrandAccent(lightColors, brand.light) },
    dark: { ...darkTheme, colors: applyBrandAccent(darkColors, brand.dark) },
  } satisfies { light: ExpoBaseTheme; dark: ExpoBaseTheme };
}

export const themes = createExpoBaseThemes(brandPresets.blue);
export type ThemeName = keyof typeof themes;
