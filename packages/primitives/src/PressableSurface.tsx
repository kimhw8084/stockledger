import type { PropsWithChildren } from 'react';
import { Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { RadiusToken } from '@expo-base/tokens';
import { useInteractionState } from './useInteractionState';

export interface PressableSurfaceProps extends PropsWithChildren {
  label: string;
  onPress: () => void;
  radius?: Exclude<RadiusToken, 'none' | 'full'>;
  selected?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function PressableSurface({ children, label, onPress, radius = 'md', selected = false, disabled = false, testID }: PressableSurfaceProps) {
  const { hovered, focused, interactionProps } = useInteractionState();
  return (
    <Pressable
      accessibilityRole="button"
      role="button"
      accessibilityLabel={label}
      aria-label={label}
      accessibilityState={{ selected, disabled }}
      aria-pressed={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      {...interactionProps}
      style={({ pressed }) => [
        styles.base,
        styles[`r_${radius}`],
        hovered && !disabled && styles.hovered,
        selected && styles.selected,
        focused && styles.focused,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: { minWidth: 0 },
  r_xs: { borderRadius: theme.radii.xs },
  r_sm: { borderRadius: theme.radii.sm },
  r_md: { borderRadius: theme.radii.md },
  r_lg: { borderRadius: theme.radii.lg },
  r_xl: { borderRadius: theme.radii.xl },
  hovered: { backgroundColor: theme.colors.background.subtle },
  selected: { backgroundColor: theme.colors.interactive.subtle },
  focused: { boxShadow: `0 0 0 ${theme.interactionFeedback.focusRingWidth}px ${theme.colors.border.focus}` },
  pressed: { opacity: theme.interactionFeedback.pressedOpacity },
  disabled: { opacity: theme.interactionFeedback.disabledOpacity },
}));
