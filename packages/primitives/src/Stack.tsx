import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { SpacingToken } from '@expo-base/tokens';
import { densitySpacingToken, useDensity } from './Density';

export interface StackProps extends PropsWithChildren {
  gap?: Exclude<SpacingToken, 'none' | 'xxs'>;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between';
  wrap?: boolean;
}

export function VStack({ children, gap = 'lg', align = 'stretch', justify = 'start' }: StackProps) {
  const density = useDensity();
  const resolvedGap = densitySpacingToken(gap, density);
  return <View style={[styles.base, styles.column, styles[`gap_${resolvedGap}`], styles[`align_${align}`], styles[`justify_${justify}`]]}>{children}</View>;
}

export function HStack({ children, gap = 'md', align = 'center', justify = 'start', wrap = true }: StackProps) {
  const density = useDensity();
  const resolvedGap = densitySpacingToken(gap, density);
  return <View style={[styles.base, styles.row, wrap && styles.wrap, styles[`gap_${resolvedGap}`], styles[`align_${align}`], styles[`justify_${justify}`]]}>{children}</View>;
}

const styles = StyleSheet.create((theme) => ({
  base: { minWidth: 0 },
  column: { flexDirection: 'column' },
  row: { flexDirection: 'row' },
  wrap: { flexWrap: 'wrap' },
  gap_xs: { gap: theme.spacing.xs }, gap_sm: { gap: theme.spacing.sm }, gap_md: { gap: theme.spacing.md }, gap_lg: { gap: theme.spacing.lg }, gap_xl: { gap: theme.spacing.xl }, gap_xxl: { gap: theme.spacing.xxl }, gap_xxxl: { gap: theme.spacing.xxxl }, gap_huge: { gap: theme.spacing.huge }, gap_massive: { gap: theme.spacing.massive },
  align_start: { alignItems: 'flex-start' }, align_center: { alignItems: 'center' }, align_end: { alignItems: 'flex-end' }, align_stretch: { alignItems: 'stretch' },
  justify_start: { justifyContent: 'flex-start' }, justify_center: { justifyContent: 'center' }, justify_end: { justifyContent: 'flex-end' }, justify_between: { justifyContent: 'space-between' },
}));
