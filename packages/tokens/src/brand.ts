import type { ExpoBaseColors } from './colors';

export interface BrandAccentPalette {
  primary: string;
  primaryHover: string;
  primaryPressed: string;
  onPrimary: string;
  subtle: string;
  subtleHover: string;
  subtlePressed: string;
  focus: string;
  visualizationPrimary: string;
}

export interface ExpoBaseBrand {
  name: string;
  shortName: string;
  light: BrandAccentPalette;
  dark: BrandAccentPalette;
}

export type BrandPresetName = 'blue' | 'violet' | 'green' | 'orange';

export const brandPresets: Record<BrandPresetName, ExpoBaseBrand> = {
  blue: {
    name: 'Expo Base', shortName: 'P',
    light: { primary: '#165DFF', primaryHover: '#0F52E5', primaryPressed: '#0A43C2', onPrimary: '#FFFFFF', subtle: '#EAF0FF', subtleHover: '#E2EAFF', subtlePressed: '#D7E2FF', focus: '#165DFF', visualizationPrimary: '#165DFF' },
    dark: { primary: '#6F98F7', primaryHover: '#82A7FA', primaryPressed: '#9AB8FA', onPrimary: '#09111F', subtle: '#142447', subtleHover: '#192D57', subtlePressed: '#203765', focus: '#7EA6FF', visualizationPrimary: '#7EA6FF' },
  },
  violet: {
    name: 'Expo Base', shortName: 'E',
    light: { primary: '#7357E8', primaryHover: '#6045D4', primaryPressed: '#5037BE', onPrimary: '#FFFFFF', subtle: '#EEEAFE', subtleHover: '#E7E1FD', subtlePressed: '#DDD4FB', focus: '#7357E8', visualizationPrimary: '#7357E8' },
    dark: { primary: '#9A86FF', primaryHover: '#AA99FF', primaryPressed: '#B9AAFF', onPrimary: '#121017', subtle: '#211B43', subtleHover: '#292154', subtlePressed: '#332963', focus: '#AA99FF', visualizationPrimary: '#AA94FF' },
  },
  green: {
    name: 'Expo Base', shortName: 'E',
    light: { primary: '#087B54', primaryHover: '#066846', primaryPressed: '#05573B', onPrimary: '#FFFFFF', subtle: '#E6F5EF', subtleHover: '#DDF1E9', subtlePressed: '#D0EADB', focus: '#087B54', visualizationPrimary: '#087B54' },
    dark: { primary: '#59C99A', primaryHover: '#6DD3A8', primaryPressed: '#84DCB8', onPrimary: '#07120E', subtle: '#102B21', subtleHover: '#143529', subtlePressed: '#194032', focus: '#6DD3A8', visualizationPrimary: '#68C99D' },
  },
  orange: {
    name: 'Expo Base', shortName: 'E',
    light: { primary: '#D45F16', primaryHover: '#BA4F0F', primaryPressed: '#9F430D', onPrimary: '#FFFFFF', subtle: '#FFF0E5', subtleHover: '#FDE7D7', subtlePressed: '#FADBC7', focus: '#D45F16', visualizationPrimary: '#D45F16' },
    dark: { primary: '#F49A5E', primaryHover: '#F7A970', primaryPressed: '#F9B884', onPrimary: '#1B0F08', subtle: '#352014', subtleHover: '#42271A', subtlePressed: '#503020', focus: '#F7A970', visualizationPrimary: '#F0A365' },
  },
};

export function applyBrandAccent(base: ExpoBaseColors, accent: BrandAccentPalette): ExpoBaseColors {
  return {
    ...base,
    border: { ...base.border, focus: accent.focus },
    interactive: {
      primary: accent.primary,
      primaryHover: accent.primaryHover,
      primaryPressed: accent.primaryPressed,
      onPrimary: accent.onPrimary,
      subtle: accent.subtle,
      subtleHover: accent.subtleHover,
      subtlePressed: accent.subtlePressed,
    },
    visualization: { ...base.visualization, series1: accent.visualizationPrimary },
  };
}
