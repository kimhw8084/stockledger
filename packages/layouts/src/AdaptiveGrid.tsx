import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export type AdaptiveGridSpan = 'standard' | 'wide' | 'full';

export function AdaptiveGrid({ children }: PropsWithChildren) {
  return <View style={styles.grid}>{children}</View>;
}

export function AdaptiveGridItem({ children, span = 'standard' }: PropsWithChildren<{ span?: AdaptiveGridSpan | undefined }>) {
  return <View style={[styles.item, styles[`span_${span}`]]}>{children}</View>;
}

const styles = StyleSheet.create((theme) => ({
  grid: {
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: { compact: theme.spacing.md, medium: theme.spacing.lg, expanded: theme.spacing.xl },
  },
  item: { minWidth: 0, flexGrow: 1 },
  span_standard: { flexBasis: { compact: '100%', medium: '46%', wide: '30%' } },
  span_wide: { flexBasis: { compact: '100%', medium: '100%', expanded: '62%' } },
  span_full: { flexBasis: '100%' },
}));
