import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '@expo-base/primitives';

export interface CodeBlockProps {
  value: string;
  label?: string;
  wrap?: boolean;
  action?: ReactNode;
  testID?: string;
}

/** Selectable preformatted content with an optional action slot for capability-owned copy behavior. */
export function CodeBlock({ value, label = 'Code', wrap = false, action, testID }: CodeBlockProps) {
  const content = <Text variant="code" direction="ltr" align="left" selectable accessibilityLabel={`${label}: ${value}`} testID={testID}>{value}</Text>;
  return (
    <View style={styles.frame} accessibilityLabel={label}>
      {action ? <View style={styles.action}>{action}</View> : null}
      {wrap ? <View style={styles.wrapped}>{content}</View> : <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.scroll}>{content}</ScrollView>}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  frame: { position: 'relative', minWidth: 0, maxWidth: '100%', borderWidth: theme.strokeWidths.standard, borderColor: theme.colors.border.default, borderRadius: theme.radii.md, backgroundColor: theme.colors.background.subtle, overflow: 'hidden' },
  wrapped: { minWidth: 0, padding: theme.spacing.lg, paddingEnd: theme.controlHeights.lg },
  scroll: { minWidth: '100%', padding: theme.spacing.lg, paddingEnd: theme.controlHeights.lg },
  action: { position: 'absolute', top: theme.spacing.sm, end: theme.spacing.sm, zIndex: theme.layers.content, backgroundColor: theme.colors.background.subtle, borderRadius: theme.radii.sm },
}));
