import type { PropsWithChildren } from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { useExpoBaseDirection } from '@expo-base/i18n';

export type TextVariant = 'display' | 'h1' | 'h2' | 'h3' | 'bodyLg' | 'body' | 'label' | 'caption' | 'micro' | 'code';
export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'onPrimary' | 'accent' | 'positive' | 'warning' | 'negative' | 'info';

export interface TextProps extends PropsWithChildren, Pick<RNTextProps, 'numberOfLines' | 'ellipsizeMode' | 'accessibilityRole' | 'accessibilityLabel' | 'role' | 'testID' | 'maxFontSizeMultiplier' | 'selectable'> {
  variant?: TextVariant;
  tone?: TextTone;
  numeric?: boolean;
  direction?: 'locale' | 'ltr' | 'rtl';
  align?: 'start' | 'center' | 'end' | 'left' | 'right';
  'aria-level'?: number | undefined;
}

export function Text({ children, variant = 'body', tone = 'primary', numeric = false, direction = 'locale', align = 'start', accessibilityRole, role, maxFontSizeMultiplier = 2, 'aria-level': ariaLevel, ...props }: TextProps) {
  const localeDirection = useExpoBaseDirection();
  const resolvedDirection = direction === 'locale' ? localeDirection : direction;
  const heading = variant === 'h1' || variant === 'h2' || variant === 'h3';
  const resolvedRole = role ?? (heading ? 'heading' : undefined);
  const resolvedAccessibilityRole = accessibilityRole ?? (heading ? 'header' : undefined);
  const resolvedAlignment = align === 'start' ? resolvedDirection === 'rtl' ? 'right' : 'left' : align === 'end' ? resolvedDirection === 'rtl' ? 'left' : 'right' : align;
  const resolvedLevel = ariaLevel ?? (variant === 'h1' ? 1 : variant === 'h2' ? 2 : variant === 'h3' ? 3 : undefined);
  return <RNText {...props} role={resolvedRole} accessibilityRole={resolvedAccessibilityRole} aria-level={resolvedLevel} maxFontSizeMultiplier={maxFontSizeMultiplier} style={[styles.base, styles[variant], styles[`tone_${tone}`], styles[`align_${resolvedAlignment}`], styles[`direction_${resolvedDirection}`], numeric && styles.numeric]}>{children}</RNText>;
}

const styles = StyleSheet.create((theme) => ({
  base: { color: theme.colors.text.primary, flexShrink: 1 },
  display: { ...theme.typography.display, fontSize: { compact: theme.typographyMetrics.compact.display.fontSize, medium: theme.typography.display.fontSize }, lineHeight: { compact: theme.typographyMetrics.compact.display.lineHeight, medium: theme.typography.display.lineHeight } },
  h1: { ...theme.typography.h1, fontSize: { compact: theme.typographyMetrics.compact.h1.fontSize, medium: theme.typography.h1.fontSize }, lineHeight: { compact: theme.typographyMetrics.compact.h1.lineHeight, medium: theme.typography.h1.lineHeight } },
  h2: { ...theme.typography.h2, fontSize: { compact: theme.typographyMetrics.compact.h2.fontSize, medium: theme.typography.h2.fontSize }, lineHeight: { compact: theme.typographyMetrics.compact.h2.lineHeight, medium: theme.typography.h2.lineHeight } },
  h3: theme.typography.h3,
  bodyLg: theme.typography.bodyLg,
  body: theme.typography.body,
  label: theme.typography.label,
  caption: theme.typography.caption,
  micro: theme.typography.micro,
  code: theme.typography.code,
  numeric: { fontVariant: ['tabular-nums'] },
  align_left: { textAlign: 'left' },
  align_center: { textAlign: 'center' },
  align_right: { textAlign: 'right' },
  direction_ltr: { writingDirection: 'ltr' },
  direction_rtl: { writingDirection: 'rtl' },
  tone_primary: { color: theme.colors.text.primary },
  tone_secondary: { color: theme.colors.text.secondary },
  tone_tertiary: { color: theme.colors.text.tertiary },
  tone_inverse: { color: theme.colors.text.inverse },
  tone_onPrimary: { color: theme.colors.interactive.onPrimary },
  tone_accent: { color: theme.colors.interactive.primary },
  tone_positive: { color: theme.colors.feedback.positive },
  tone_warning: { color: theme.colors.feedback.warning },
  tone_negative: { color: theme.colors.feedback.negative },
  tone_info: { color: theme.colors.feedback.info },
}));
