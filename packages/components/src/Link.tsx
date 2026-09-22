import { Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon, type IconName } from '@expo-base/icons';
import { Text, useInteractionState } from '@expo-base/primitives';

export interface LinkProps {
  label: string;
  onPress: () => void;
  iconEnd?: IconName;
  disabled?: boolean;
  accessibilityLabel?: string;
}

export function Link({ label, onPress, iconEnd, disabled = false, accessibilityLabel }: LinkProps) {
  const { theme } = useUnistyles();
  const { hovered, focused, interactionProps } = useInteractionState();
  return (
    <Pressable
      accessibilityRole="link"
      role="link"
      accessibilityLabel={accessibilityLabel ?? label}
      aria-label={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      hitSlop={theme.interactionFeedback.compactHitSlop}
      {...interactionProps}
      style={({ pressed }) => [styles.base, hovered && !disabled && styles.hovered, focused && styles.focused, pressed && !disabled && styles.pressed, disabled && styles.disabled]}
    >
      <Text variant="label" tone="accent">{label}</Text>
      {iconEnd ? <Icon name={iconEnd} size="xs" tone="accent" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: { minHeight: theme.controlHeights.sm, alignItems: 'center', flexDirection: 'row', gap: theme.spacing.xs, borderRadius: theme.radii.xs, paddingHorizontal: theme.spacing.xs },
  hovered: { backgroundColor: theme.colors.interactive.subtleHover },
  focused: { boxShadow: `0 0 0 ${theme.interactionFeedback.focusRingWidth}px ${theme.colors.border.focus}` },
  pressed: { opacity: theme.interactionFeedback.pressedOpacity },
  disabled: { opacity: theme.interactionFeedback.disabledOpacity },
}));
