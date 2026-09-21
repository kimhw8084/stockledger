import { createElement, type MouseEvent as ReactMouseEvent } from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon, type IconName, type IconTone } from '@expo-base/icons';
import { Text, useInteractionState } from '@expo-base/primitives';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';
type ButtonType = 'button' | 'submit';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  type?: ButtonType;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  iconStart?: IconName;
  iconEnd?: IconName;
  accessibilityLabel?: string;
  testID?: string;
  fullWidth?: boolean;
  responsiveWidth?: 'auto' | 'compact-full';
}

export function Button({ label, onPress, type = 'button', variant = 'primary', size = 'md', disabled = false, loading = false, iconStart, iconEnd, accessibilityLabel, testID, fullWidth = false, responsiveWidth = 'auto' }: ButtonProps) {
  const unavailable = disabled || loading;
  const { theme, rt } = useUnistyles();
  const { hovered, focused, interactionProps } = useInteractionState();
  const iconTone: IconTone = variant === 'primary' || variant === 'danger' ? 'onPrimary' : 'primary';
  const iconSize = size === 'lg' ? 'md' : 'sm';
  const buttonStyle = [
    styles.base, fullWidth && styles.fullWidth, responsiveWidth === 'compact-full' && styles.compactFull, styles[size], styles[variant],
    hovered && !unavailable && styles[`${variant}Hover`],
    focused && styles.focused,
    unavailable && styles.disabled,
  ];
  const content = (
    <View style={styles.content} accessibilityElementsHidden={loading} importantForAccessibility={loading ? 'no-hide-descendants' : 'auto'}>
      <View style={[styles.buttonContent, loading && styles.loadingContent]}>
        {iconStart ? <View style={styles.icon}><Icon name={iconStart} size={iconSize} tone={iconTone} /></View> : null}
        <View style={styles.label}><Text variant="label" align="center" tone={variant === 'primary' || variant === 'danger' ? 'onPrimary' : 'primary'}>{label}</Text></View>
        {iconEnd ? <View style={styles.icon}><Icon name={iconEnd} size={iconSize} tone={iconTone} /></View> : null}
      </View>
      {loading ? <ActivityIndicator size={size === 'lg' ? 'large' : 'small'} style={styles.loadingIndicator} color={variant === 'primary' || variant === 'danger' ? theme.colors.interactive.onPrimary : theme.colors.text.primary} /> : null}
    </View>
  );

  if (Platform.OS === 'web' && type === 'submit') {
    const fillsWebWidth = fullWidth || (responsiveWidth === 'compact-full' && rt.breakpoint === 'compact');
    return createElement('button', {
      type: 'submit',
      disabled: unavailable,
      tabIndex: 0,
      role: 'button',
      'aria-label': accessibilityLabel ?? label,
      'aria-disabled': unavailable,
      'aria-busy': loading,
      'data-testid': testID,
      onMouseEnter: interactionProps.onHoverIn,
      onMouseLeave: interactionProps.onHoverOut,
      onFocus: interactionProps.onFocus,
      onBlur: interactionProps.onBlur,
      onClick: (event: ReactMouseEvent<HTMLButtonElement>) => { if (!event.currentTarget.form) onPress(); },
      style: { all: 'unset', display: fillsWebWidth ? 'flex' : 'inline-flex', width: fillsWebWidth ? '100%' : 'auto', maxWidth: '100%', alignSelf: fillsWebWidth ? 'stretch' : 'flex-start', cursor: unavailable ? 'default' : 'pointer' },
    }, <View style={[buttonStyle, styles.pointerEventsNone]}>{content}</View>);
  }

  return (
    <Pressable
      accessibilityRole="button"
      role="button"
      accessibilityLabel={accessibilityLabel ?? label}
      aria-label={accessibilityLabel ?? label}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      aria-disabled={unavailable}
      aria-busy={loading}
      disabled={unavailable}
      onPress={onPress}
      testID={testID}
      hitSlop={size === 'sm' ? theme.interactionFeedback.compactHitSlop : undefined}
      {...interactionProps}
      style={({ pressed }) => [...buttonStyle, pressed && !unavailable && styles[`${variant}Pressed`]]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: { minWidth: 0, maxWidth: '100%', alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', borderWidth: theme.strokeWidths.standard },
  content: { minWidth: 0, maxWidth: '100%', position: 'relative', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: theme.spacing.sm, pointerEvents: 'none' },
  pointerEventsNone: { pointerEvents: 'none' },
  buttonContent: { minWidth: 0, maxWidth: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: theme.spacing.sm },
  label: { minWidth: 0, flexShrink: 1 },
  icon: { flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  loadingContent: { opacity: 0 },
  loadingIndicator: { position: 'absolute' },
  fullWidth: { width: '100%', alignSelf: 'stretch' },
  compactFull: { width: { compact: '100%', medium: 'auto' }, alignSelf: { compact: 'stretch', medium: 'flex-start' } },
  sm: { minHeight: theme.controlHeights.sm, paddingHorizontal: theme.spacing.md, borderRadius: theme.radii.sm },
  md: { minHeight: theme.controlHeights.md, paddingHorizontal: theme.spacing.lg, borderRadius: theme.radii.sm },
  lg: { minHeight: theme.controlHeights.lg, paddingHorizontal: theme.spacing.xl, borderRadius: theme.radii.md },
  primary: { backgroundColor: theme.colors.interactive.primary, borderColor: theme.colors.interactive.primary },
  secondary: { backgroundColor: theme.colors.background.subtle, borderColor: theme.colors.border.default },
  outline: { backgroundColor: theme.colors.transparent, borderColor: theme.colors.border.strong },
  ghost: { backgroundColor: theme.colors.transparent, borderColor: theme.colors.transparent },
  danger: { backgroundColor: theme.colors.feedback.negative, borderColor: theme.colors.feedback.negative },
  primaryHover: { backgroundColor: theme.colors.interactive.primaryHover, borderColor: theme.colors.interactive.primaryHover },
  secondaryHover: { backgroundColor: theme.colors.interactive.subtleHover },
  outlineHover: { backgroundColor: theme.colors.background.subtle },
  ghostHover: { backgroundColor: theme.colors.background.subtle },
  dangerHover: { backgroundColor: theme.colors.feedback.negativeHover, borderColor: theme.colors.feedback.negativeHover },
  primaryPressed: { backgroundColor: theme.colors.interactive.primaryPressed, borderColor: theme.colors.interactive.primaryPressed },
  secondaryPressed: { backgroundColor: theme.colors.interactive.subtlePressed },
  outlinePressed: { backgroundColor: theme.colors.interactive.subtlePressed },
  ghostPressed: { backgroundColor: theme.colors.interactive.subtlePressed },
  dangerPressed: { backgroundColor: theme.colors.feedback.negativePressed, borderColor: theme.colors.feedback.negativePressed },
  focused: { boxShadow: `0 0 0 ${theme.interactionFeedback.focusRingWidth}px ${theme.colors.border.focus}` },
  disabled: { opacity: theme.interactionFeedback.disabledOpacity },
}));
