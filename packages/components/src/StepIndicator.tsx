import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '@expo-base/primitives';

export interface StepIndicatorStep {
  id: string;
  label: string;
}

export interface StepIndicatorProps {
  steps: readonly StepIndicatorStep[];
  currentStep: number;
  label?: string | undefined;
  testID?: string | undefined;
}

/** Announces workflow position while allowing the owning wizard to keep its domain validation and routing. */
export function StepIndicator({ steps, currentStep, label = 'Workflow progress', testID }: StepIndicatorProps) {
  const total = Math.max(steps.length, 1);
  const current = Math.max(1, Math.min(total, Math.trunc(currentStep)));
  return (
    <View
      accessibilityRole="progressbar"
      role="progressbar"
      accessibilityLabel={`${label}: step ${current} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: current, text: `Step ${current} of ${total}` }}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      style={styles.root}
      testID={testID}
    >
      {steps.map((step, index) => {
        const position = index + 1;
        const complete = position < current;
        const active = position === current;
        return (
          <View key={step.id} style={styles.step}>
            <View style={[styles.marker, complete && styles.complete, active && styles.active]}><Text variant="micro" tone={complete || active ? 'onPrimary' : 'secondary'}>{String(position)}</Text></View>
            <Text variant="caption" tone={active ? 'primary' : 'secondary'} numberOfLines={2} align="center">{step.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.xs },
  step: { minWidth: 0, flex: 1, alignItems: 'center', gap: theme.spacing.xs },
  marker: { width: theme.controlHeights.sm, height: theme.controlHeights.sm, borderRadius: theme.radii.full, alignItems: 'center', justifyContent: 'center', borderWidth: theme.strokeWidths.standard, borderColor: theme.colors.border.strong, backgroundColor: theme.colors.background.surface },
  complete: { backgroundColor: theme.colors.feedback.positive, borderColor: theme.colors.feedback.positive },
  active: { backgroundColor: theme.colors.interactive.primary, borderColor: theme.colors.interactive.primary },
}));
