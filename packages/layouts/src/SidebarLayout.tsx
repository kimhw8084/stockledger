import type { PropsWithChildren, ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { ResponsiveSlot } from './Responsive';

export interface SidebarLayoutProps extends PropsWithChildren {
  sidebar: ReactNode;
  compactHeader?: ReactNode;
  width?: 'compact' | 'standard';
}

export function SidebarLayout({ sidebar, compactHeader, width = 'standard', children }: SidebarLayoutProps) {
  return (
    <View style={styles.root}>
      <ResponsiveSlot until="expanded">{compactHeader}</ResponsiveSlot>
      <View style={styles.body}>
        <ResponsiveSlot from="expanded">
          <View style={[styles.sidebar, styles[`sidebar_${width}`]]}>{sidebar}</View>
        </ResponsiveSlot>
        <View style={styles.main}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, minWidth: 0 },
  body: { flex: 1, minWidth: 0, flexDirection: 'row' },
  sidebar: {
    flexShrink: 0,
    borderEndWidth: theme.strokeWidths.standard,
    borderEndColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.background.surface,
  },
  sidebar_compact: { width: theme.layoutDimensions.sidebar.compact },
  sidebar_standard: { width: theme.layoutDimensions.sidebar.standard },
  main: { flex: 1, minWidth: 0 },
}));
