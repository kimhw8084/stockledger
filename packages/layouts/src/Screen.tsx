import type { PropsWithChildren } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export interface ScreenProps extends PropsWithChildren {
  safeArea?: 'none' | 'top' | 'bottom' | 'all';
}

export interface ScrollScreenProps extends PropsWithChildren, Pick<ScrollViewProps, 'keyboardShouldPersistTaps' | 'keyboardDismissMode'> {
  safeArea?: 'none' | 'top' | 'bottom' | 'all';
}

export function Screen({ children, safeArea = 'all' }: ScreenProps) {
  return <View role="main" style={[styles.screen, styles[`safe_${safeArea}`]]}>{children}</View>;
}

export function ScrollScreen({
  children,
  safeArea = 'all',
  keyboardShouldPersistTaps = 'handled',
  keyboardDismissMode = 'interactive',
}: ScrollScreenProps) {
  return (
    <View role="main" style={[styles.screen, styles[`safe_${safeArea}`]]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  screen: {
    flex: 1,
    minWidth: 0,
    backgroundColor: theme.colors.background.canvas,
  },
  scroll: { flex: 1, minWidth: 0 },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    minWidth: 0,
    paddingHorizontal: { compact: theme.spacing.lg, medium: theme.spacing.xl, expanded: theme.spacing.xxl, wide: theme.spacing.xxxl },
    paddingTop: { compact: theme.spacing.xl, expanded: theme.spacing.xxl },
    paddingBottom: theme.spacing.huge,
  },
  safe_none: {},
  safe_top: { paddingTop: rt.insets.top },
  safe_bottom: { paddingBottom: rt.insets.bottom },
  safe_all: {
    paddingTop: rt.insets.top,
    paddingBottom: rt.insets.bottom,
    paddingLeft: rt.insets.left,
    paddingRight: rt.insets.right,
  },
}));
