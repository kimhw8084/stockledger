import type { PropsWithChildren, ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

/**
 * Owns the persistent page-action surface. It deliberately owns only safe-area,
 * elevation, and responsive placement; forms and workflows still own the action
 * semantics through FormActions or PriorityActionBar.
 */
export interface StickyActionBarProps extends PropsWithChildren {
  accessory?: ReactNode | undefined;
  testID?: string | undefined;
}

export function StickyActionBar({ children, accessory, testID }: StickyActionBarProps) {
  return (
    <View accessibilityRole="toolbar" role="toolbar" accessibilityLabel="Page actions" aria-label="Page actions" style={styles.root} testID={testID}>
      <View style={styles.content}>
        <View style={styles.actions}>{children}</View>
        {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  root: {
    minWidth: 0,
    borderTopWidth: theme.strokeWidths.standard,
    borderTopColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.background.surface,
    paddingTop: theme.spacing.md,
    paddingBottom: rt.insets.bottom + theme.spacing.md,
    paddingStart: rt.insets.left + theme.spacing.lg,
    paddingEnd: rt.insets.right + theme.spacing.lg,
    ...theme.elevation.low,
  },
  content: {
    width: '100%',
    minWidth: 0,
    alignSelf: 'center',
    maxWidth: theme.contentWidths.form,
    flexDirection: { compact: 'column', medium: 'row' },
    alignItems: { compact: 'stretch', medium: 'center' },
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  actions: { minWidth: 0, flex: 1 },
  accessory: { minWidth: 0, flexShrink: 0, alignSelf: { compact: 'stretch', medium: 'center' } },
}));
