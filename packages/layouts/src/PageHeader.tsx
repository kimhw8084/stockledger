import type { ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text, VStack } from '@expo-base/primitives';

export interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  metadata?: ReactNode;
}

export function PageHeader({ title, description, eyebrow, actions, metadata }: PageHeaderProps) {
  return (
    <View style={styles.root}>
      <View style={styles.copy}>
        <VStack gap="xs">
          {eyebrow ? <Text variant="micro" tone="secondary">{eyebrow}</Text> : null}
          <Text variant="h1">{title}</Text>
          {description ? <Text tone="secondary">{description}</Text> : null}
          {metadata ? <View style={styles.metadata}>{metadata}</View> : null}
        </VStack>
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    minWidth: 0,
    flexDirection: { compact: 'column', expanded: 'row' },
    alignItems: { compact: 'stretch', expanded: 'flex-start' },
    justifyContent: 'space-between',
    gap: { compact: theme.spacing.lg, expanded: theme.spacing.xl },
  },
  copy: { minWidth: 0, flex: 1, maxWidth: theme.contentWidths.reading },
  metadata: { minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm, paddingTop: theme.spacing.xs },
  actions: {
    minWidth: 0,
    width: { compact: '100%', expanded: 'auto' },
    maxWidth: '100%',
    flexShrink: 1,
    alignSelf: { compact: 'stretch', expanded: 'flex-start' },
    alignItems: { compact: 'stretch', expanded: 'flex-end' },
  },
}));
