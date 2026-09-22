import type { ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text, VStack } from '@expo-base/primitives';

export interface SectionHeaderProps {
  title: string;
  description?: string | undefined;
  eyebrow?: string | undefined;
  accessory?: ReactNode;
  testID?: string;
}

export function SectionHeader({ title, description, eyebrow, accessory, testID }: SectionHeaderProps) {
  return (
    <View style={styles.root} testID={testID}>
      <View style={styles.copy}>
        <VStack gap="xs">
          {eyebrow ? <Text variant="micro" tone="secondary">{eyebrow}</Text> : null}
          <Text variant="h2">{title}</Text>
          {description ? <Text tone="secondary">{description}</Text> : null}
        </VStack>
      </View>
      {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    minWidth: 0,
    flexDirection: { compact: 'column', medium: 'row' },
    alignItems: { compact: 'stretch', medium: 'flex-start' },
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  copy: {
    minWidth: 0,
    flex: 1,
    width: { compact: '100%', medium: 'auto' },
    maxWidth: theme.contentWidths.reading,
  },
  accessory: {
    minWidth: 0,
    flexShrink: 0,
    alignSelf: { compact: 'flex-start', medium: 'flex-start' },
  },
}));
