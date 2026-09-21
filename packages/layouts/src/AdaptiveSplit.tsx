import type { ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export interface AdaptiveSplitProps {
  primary: ReactNode;
  secondary: ReactNode;
  secondaryWidth?: 'minimum' | 'standard' | 'wide';
  reverseOnCompact?: boolean;
}

export function AdaptiveSplit({ primary, secondary, secondaryWidth = 'standard', reverseOnCompact = false }: AdaptiveSplitProps) {
  return (
    <View style={[styles.root, reverseOnCompact && styles.reverseCompact]}>
      <View style={styles.primary}>{primary}</View>
      <View style={[styles.secondary, styles[`secondary_${secondaryWidth}`]]}>{secondary}</View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    minWidth: 0,
    flexDirection: { compact: 'column', expanded: 'row' },
    alignItems: 'stretch',
    gap: { compact: theme.spacing.lg, expanded: theme.spacing.xl, wide: theme.spacing.xxl },
  },
  reverseCompact: {
    flexDirection: { compact: 'column-reverse', expanded: 'row' },
  },
  primary: {
    minWidth: 0,
    flexGrow: { compact: 0, expanded: 1 },
    flexShrink: 1,
    flexBasis: { compact: 'auto', expanded: 0 },
  },
  secondary: {
    minWidth: 0,
    flexShrink: 1,
    flexBasis: { compact: 'auto', expanded: theme.layoutDimensions.inspector.standard },
    maxWidth: { compact: '100%', expanded: theme.layoutDimensions.inspector.wide },
  },
  secondary_minimum: { flexBasis: { expanded: theme.layoutDimensions.inspector.minimum } },
  secondary_standard: { flexBasis: { expanded: theme.layoutDimensions.inspector.standard } },
  secondary_wide: { flexBasis: { expanded: theme.layoutDimensions.inspector.wide } },
}));
