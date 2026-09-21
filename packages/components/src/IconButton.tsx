import { Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon, type IconName } from '@expo-base/icons';
import { useInteractionState } from '@expo-base/primitives';

type IconButtonVariant = 'default' | 'subtle' | 'ghost' | 'danger';
type IconButtonSize = 'sm' | 'md' | 'lg';

export interface IconButtonProps { icon: IconName; label: string; onPress: () => void; variant?: IconButtonVariant; size?: IconButtonSize; selected?: boolean; disabled?: boolean; testID?: string; }

export function IconButton({ icon, label, onPress, variant = 'default', size = 'md', selected = false, disabled = false, testID }: IconButtonProps) {
  const tone = variant === 'danger' ? 'negative' : selected ? 'accent' : 'primary';
  const { theme } = useUnistyles();
  const { hovered, focused, interactionProps } = useInteractionState();
  return (
    <Pressable accessibilityRole="button" role="button" accessibilityLabel={label} aria-label={label} accessibilityState={{ disabled, selected }} aria-disabled={disabled} aria-pressed={selected} disabled={disabled} onPress={onPress} testID={testID} hitSlop={size === 'sm' ? theme.interactionFeedback.compactHitSlop : undefined} {...interactionProps}
      style={({ pressed }) => [styles.base, styles[size], styles[variant], selected && styles.selected, hovered && !disabled && (variant === 'danger' ? styles.dangerHovered : styles.hovered), focused && styles.focused, pressed && !disabled && (variant === 'danger' ? styles.dangerPressed : styles.pressed), disabled && styles.disabled]}>
      <Icon name={icon} size={size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md'} tone={tone} />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: theme.strokeWidths.standard, flexShrink: 0 },
  sm: { width: theme.controlHeights.sm, height: theme.controlHeights.sm, borderRadius: theme.radii.sm },
  md: { width: theme.controlHeights.md, height: theme.controlHeights.md, borderRadius: theme.radii.sm },
  lg: { width: theme.controlHeights.lg, height: theme.controlHeights.lg, borderRadius: theme.radii.md },
  default: { backgroundColor: theme.colors.background.surface, borderColor: theme.colors.border.default },
  subtle: { backgroundColor: theme.colors.background.subtle, borderColor: theme.colors.border.subtle },
  ghost: { backgroundColor: theme.colors.transparent, borderColor: theme.colors.transparent },
  danger: { backgroundColor: theme.colors.feedback.negativeSurface, borderColor: theme.colors.transparent },
  selected: { backgroundColor: theme.colors.interactive.subtle, borderColor: theme.colors.interactive.primary },
  hovered: { backgroundColor: theme.colors.interactive.subtleHover },
  dangerHovered: { backgroundColor: theme.colors.feedback.negativeSurfaceHover, borderColor: theme.colors.feedback.negative },
  focused: { boxShadow: `0 0 0 ${theme.interactionFeedback.focusRingWidth}px ${theme.colors.border.focus}` },
  pressed: { opacity: theme.interactionFeedback.pressedOpacity },
  dangerPressed: { backgroundColor: theme.colors.feedback.negativeSurfacePressed, borderColor: theme.colors.feedback.negative },
  disabled: { opacity: theme.interactionFeedback.disabledOpacity },
}));
