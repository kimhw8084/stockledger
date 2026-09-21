import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useDensity } from '@expo-base/primitives';

export type CardVariant = 'surface' | 'subtle' | 'elevated';
export type CardPadding = 'default' | 'compact' | 'none';

export interface CardProps extends PropsWithChildren {
  variant?: CardVariant;
  padding?: CardPadding;
  testID?: string;
}

export function Card({ children, variant = 'surface', padding = 'default', testID }: CardProps) {
  const density = useDensity();
  const resolvedPadding = padding === 'default' && density === 'compact' ? 'compact' : padding;
  return (
    <View
      testID={testID}
      style={[styles.base, styles[variant], styles[`padding_${resolvedPadding}`]]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: {
    minWidth: 0,
    borderWidth: theme.strokeWidths.standard,
    borderRadius: theme.radii.lg,
  },
  surface: {
    backgroundColor: theme.colors.background.surface,
    borderColor: theme.colors.border.default,
    ...theme.elevation.none,
  },
  subtle: {
    backgroundColor: theme.colors.background.subtle,
    borderColor: theme.colors.border.subtle,
    ...theme.elevation.none,
  },
  elevated: {
    backgroundColor: theme.colors.background.elevated,
    borderColor: theme.colors.border.subtle,
    ...theme.elevation.low,
  },
  padding_default: {
    padding: { compact: theme.spacing.lg, expanded: theme.spacing.xl },
  },
  padding_compact: {
    padding: { compact: theme.spacing.md, expanded: theme.spacing.lg },
  },
  padding_none: {
    padding: theme.spacing.none,
  },
}));
