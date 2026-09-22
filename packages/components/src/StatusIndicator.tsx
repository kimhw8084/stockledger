import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { HStack, Text, VStack } from '@expo-base/primitives';

export type StatusIndicatorTone = 'neutral' | 'info' | 'positive' | 'warning' | 'negative';

export interface StatusIndicatorProps {
  label: string;
  description?: string;
  tone?: StatusIndicatorTone;
  testID?: string;
}

/** A status is always named; color is supporting information, never the only signal. */
export function StatusIndicator({ label, description, tone = 'neutral', testID }: StatusIndicatorProps) {
  return (
    <HStack gap="sm" align="start">
      <View accessibilityElementsHidden importantForAccessibility="no" style={[styles.dot, styles[tone]]} />
      <VStack gap="xs">
        <Text variant="label" testID={testID}>{label}</Text>
        {description ? <Text variant="caption" tone="secondary">{description}</Text> : null}
      </VStack>
    </HStack>
  );
}

const styles = StyleSheet.create((theme) => ({
  dot: { width: theme.spacing.sm, height: theme.spacing.sm, marginTop: theme.spacing.xs, borderRadius: theme.radii.full, borderWidth: theme.strokeWidths.standard, borderColor: theme.colors.border.strong },
  neutral: { backgroundColor: theme.colors.text.tertiary },
  info: { backgroundColor: theme.colors.feedback.info },
  positive: { backgroundColor: theme.colors.feedback.positive },
  warning: { backgroundColor: theme.colors.feedback.warning },
  negative: { backgroundColor: theme.colors.feedback.negative },
}));
