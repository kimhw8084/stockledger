import { forwardRef, useRef, type ComponentRef } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useExpoBaseDirection } from '@expo-base/i18n';
import { resolveRovingFocusIndex } from '@expo-base/platform';
import { Text, useInteractionState } from '@expo-base/primitives';

export interface SegmentedControlOption {
  value: string;
  label: string;
  disabled?: boolean | undefined;
}

export interface SegmentedControlProps {
  label: string;
  value: string;
  options: readonly SegmentedControlOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  testID?: string | undefined;
}

/** A finite single-choice control; use a SelectField or Combobox for large option sets. */
export function SegmentedControl({ label, value, options, onChange, disabled = false, invalid = false, testID }: SegmentedControlProps) {
  const direction = useExpoBaseDirection();
  const itemRefs = useRef<Array<ComponentRef<typeof Pressable> | null>>([]);
  const enabled = options.map((option) => !disabled && !option.disabled);
  const selectedIndex = options.findIndex((option, index) => option.value === value && enabled[index]);
  const tabStopIndex = selectedIndex >= 0 ? selectedIndex : enabled.findIndex(Boolean);
  const navigate = (index: number, event: WebKeyboardEvent) => {
    const next = resolveRovingFocusIndex(event.key, index, enabled, { direction });
    if (next === null) return;
    event.preventDefault();
    itemRefs.current[next]?.focus();
    const option = options[next];
    if (option) onChange(option.value);
  };
  return (
    <View accessibilityRole="radiogroup" role="radiogroup" accessibilityLabel={label} aria-label={label} aria-invalid={invalid} style={[styles.root, invalid && styles.invalid]} testID={testID}>
      {options.map((option, index) => (
        <Segment ref={(node) => { itemRefs.current[index] = node; }} key={option.value} testID={testID ? `${testID}-${option.value}` : `${label}-${option.value}`} option={option} selected={option.value === value} disabled={disabled || Boolean(option.disabled)} tabIndex={index === tabStopIndex ? 0 as const : -1 as const} onKeyDown={(event) => navigate(index, event)} onPress={() => onChange(option.value)} />
      ))}
    </View>
  );
}

type WebKeyboardEvent = { key: string; preventDefault: () => void };

const Segment = forwardRef<ComponentRef<typeof Pressable>, { option: SegmentedControlOption; testID?: string; selected: boolean; disabled: boolean; tabIndex: 0 | -1; onKeyDown: (event: WebKeyboardEvent) => void; onPress: () => void }>(function Segment({ option, testID, selected, disabled, tabIndex, onKeyDown, onPress }, ref) {
  const { hovered, focused, interactionProps } = useInteractionState();
  const keyboardProps = Platform.OS === 'web' ? { onKeyDown } : {};
  return (
    <Pressable
      ref={ref}
      accessibilityRole="radio"
      role="radio"
      accessibilityLabel={option.label}
      accessibilityState={{ checked: selected, disabled }}
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      testID={testID}
      tabIndex={tabIndex}
      onPress={onPress}
      {...keyboardProps}
      {...interactionProps}
      style={({ pressed }) => [styles.segment, selected && styles.selected, hovered && !disabled && styles.hovered, focused && styles.focused, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
    >
      <Text variant="label" tone={selected ? 'onPrimary' : 'primary'} numberOfLines={2} align="center">{option.label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create((theme) => ({
  root: { minWidth: 0, flexDirection: 'row', alignItems: 'stretch', gap: theme.spacing.xs, padding: theme.spacing.xs, borderWidth: theme.strokeWidths.standard, borderColor: theme.colors.border.default, borderRadius: theme.radii.md, backgroundColor: theme.colors.background.subtle },
  segment: { minWidth: 0, minHeight: theme.controlHeights.md, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.sm, borderWidth: theme.strokeWidths.standard, borderColor: theme.colors.transparent },
  selected: { backgroundColor: theme.colors.interactive.primary, borderColor: theme.colors.interactive.primary },
  invalid: { borderColor: theme.colors.feedback.negative },
  hovered: { backgroundColor: theme.colors.background.surface },
  focused: { borderColor: theme.colors.border.focus, boxShadow: `0 0 0 ${theme.interactionFeedback.focusRingWidth}px ${theme.colors.border.focus}` },
  pressed: { opacity: theme.interactionFeedback.pressedOpacity },
  disabled: { opacity: theme.interactionFeedback.disabledOpacity },
}));
