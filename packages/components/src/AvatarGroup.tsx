import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '@expo-base/primitives';
import { Avatar, type AvatarProps } from './Avatar';

export interface AvatarGroupItem extends Omit<AvatarProps, 'size' | 'decorative' | 'testID'> {
  id: string;
}

export interface AvatarGroupProps {
  items: readonly AvatarGroupItem[];
  label: string;
  size?: AvatarProps['size'];
  maxVisible?: number;
  testID?: string;
}

export function AvatarGroup({ items, label, size = 'md', maxVisible = 4, testID }: AvatarGroupProps) {
  const visibleCount = Math.max(1, Math.trunc(maxVisible));
  const visible = items.slice(0, visibleCount);
  const overflow = Math.max(0, items.length - visible.length);
  return (
    <View role="group" accessibilityLabel={label} style={styles.group} testID={testID}>
      {visible.map((item, index) => <View key={item.id} style={index > 0 ? styles.overlap : undefined}><Avatar {...item} size={size} decorative /></View>)}
      {overflow > 0 ? <View style={[styles.overflow, styles[`overflow_${size}`], visible.length > 0 && styles.overlap]}><Text variant={size === 'lg' ? 'label' : 'micro'} accessibilityLabel={`${overflow} more`}>+{overflow}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  group: { minWidth: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.xs },
  overlap: { marginStart: -theme.spacing.sm },
  overflow: { alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: theme.radii.full, backgroundColor: theme.colors.background.subtle, borderWidth: theme.strokeWidths.emphasis, borderColor: theme.colors.background.surface },
  overflow_sm: { width: theme.controlHeights.sm, height: theme.controlHeights.sm },
  overflow_md: { width: theme.controlHeights.md, height: theme.controlHeights.md },
  overflow_lg: { width: theme.controlHeights.lg, height: theme.controlHeights.lg },
}));
