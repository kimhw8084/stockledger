import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export type SafeAreaEdges = 'none' | 'top' | 'bottom' | 'horizontal' | 'all';

export function SafeAreaRegion({ children, edges = 'all' }: PropsWithChildren<{ edges?: SafeAreaEdges }>) {
  return <View style={[styles.base, styles[edges]]}>{children}</View>;
}

const styles = StyleSheet.create((_, rt) => ({
  base: { minWidth: 0 },
  none: {},
  top: { paddingTop: rt.insets.top },
  bottom: { paddingBottom: rt.insets.bottom },
  horizontal: { paddingLeft: rt.insets.left, paddingRight: rt.insets.right },
  all: {
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom,
    paddingLeft: rt.insets.left,
    paddingRight: rt.insets.right,
  },
}));
