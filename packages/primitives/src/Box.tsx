import type { PropsWithChildren } from 'react';
import { View, type AccessibilityProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { RadiusToken, SpacingToken } from '@expo-base/tokens';

type Surface = 'none' | 'canvas' | 'surface' | 'subtle' | 'elevated';

export interface BoxProps extends PropsWithChildren, AccessibilityProps {
  surface?: Surface;
  padding?: SpacingToken;
  paddingX?: SpacingToken;
  paddingY?: SpacingToken;
  radius?: RadiusToken;
  grow?: boolean;
  testID?: string;
}

export function Box({
  children,
  surface = 'none',
  padding = 'none',
  paddingX = 'none',
  paddingY = 'none',
  radius = 'none',
  grow = false,
  ...accessibility
}: BoxProps) {
  return (
    <View
      {...accessibility}
      style={[
        styles.base,
        grow && styles.grow,
        styles[surface],
        padding !== 'none' && styles[`p_${padding}`],
        paddingX !== 'none' && styles[`px_${paddingX}`],
        paddingY !== 'none' && styles[`py_${paddingY}`],
        radius !== 'none' && styles[`r_${radius}`],
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: { minWidth: 0 },
  grow: { flex: 1 },
  none: {},
  canvas: { backgroundColor: theme.colors.background.canvas },
  surface: { backgroundColor: theme.colors.background.surface },
  subtle: { backgroundColor: theme.colors.background.subtle },
  elevated: { backgroundColor: theme.colors.background.elevated },
  p_xxs: { padding: theme.spacing.xxs }, p_xs: { padding: theme.spacing.xs }, p_sm: { padding: theme.spacing.sm }, p_md: { padding: theme.spacing.md }, p_lg: { padding: theme.spacing.lg }, p_xl: { padding: theme.spacing.xl }, p_xxl: { padding: theme.spacing.xxl }, p_xxxl: { padding: theme.spacing.xxxl }, p_huge: { padding: theme.spacing.huge }, p_massive: { padding: theme.spacing.massive },
  px_xxs: { paddingHorizontal: theme.spacing.xxs }, px_xs: { paddingHorizontal: theme.spacing.xs }, px_sm: { paddingHorizontal: theme.spacing.sm }, px_md: { paddingHorizontal: theme.spacing.md }, px_lg: { paddingHorizontal: theme.spacing.lg }, px_xl: { paddingHorizontal: theme.spacing.xl }, px_xxl: { paddingHorizontal: theme.spacing.xxl }, px_xxxl: { paddingHorizontal: theme.spacing.xxxl }, px_huge: { paddingHorizontal: theme.spacing.huge }, px_massive: { paddingHorizontal: theme.spacing.massive },
  py_xxs: { paddingVertical: theme.spacing.xxs }, py_xs: { paddingVertical: theme.spacing.xs }, py_sm: { paddingVertical: theme.spacing.sm }, py_md: { paddingVertical: theme.spacing.md }, py_lg: { paddingVertical: theme.spacing.lg }, py_xl: { paddingVertical: theme.spacing.xl }, py_xxl: { paddingVertical: theme.spacing.xxl }, py_xxxl: { paddingVertical: theme.spacing.xxxl }, py_huge: { paddingVertical: theme.spacing.huge }, py_massive: { paddingVertical: theme.spacing.massive },
  r_xs: { borderRadius: theme.radii.xs }, r_sm: { borderRadius: theme.radii.sm }, r_md: { borderRadius: theme.radii.md }, r_lg: { borderRadius: theme.radii.lg }, r_xl: { borderRadius: theme.radii.xl }, r_full: { borderRadius: theme.radii.full },
}));
