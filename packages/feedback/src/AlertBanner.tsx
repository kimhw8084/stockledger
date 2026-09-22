import type { ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon, type IconName } from '@expo-base/icons';
import { Text, VStack } from '@expo-base/primitives';

export type AlertTone = 'info' | 'positive' | 'warning' | 'negative';
export interface AlertBannerProps {
  tone?: AlertTone | undefined;
  title: string;
  message?: string | undefined;
  action?: ReactNode | undefined;
  icon?: IconName | undefined;
}

export function AlertBanner({ tone = 'info', title, message, action, icon }: AlertBannerProps) {
  const resolvedIcon = icon ?? (tone === 'positive' ? 'check' : tone === 'warning' || tone === 'negative' ? 'warning' : 'info');
  return (
    <View accessibilityRole={tone === 'negative' ? 'alert' : undefined} accessibilityLiveRegion={tone === 'negative' ? 'assertive' : 'polite'} role={tone === 'negative' ? 'alert' : 'status'} aria-live={tone === 'negative' ? 'assertive' : 'polite'} style={[styles.base, styles[`tone_${tone}`]]}>
      <View style={styles.content}>
        <View style={styles.icon}>
          <Icon name={resolvedIcon} tone={tone} size="sm" />
        </View>
        <View style={styles.copy}>
          <VStack gap="xs">
            <Text variant="label" tone={tone}>{title}</Text>
            {message ? <Text variant="caption" tone="secondary">{message}</Text> : null}
          </VStack>
        </View>
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

export function InlineMessage({ tone = 'info', children }: { tone?: AlertTone; children: string }) {
  return (
    <View accessibilityRole={tone === 'negative' ? 'alert' : undefined} accessibilityLiveRegion={tone === 'negative' ? 'assertive' : 'polite'} role={tone === 'negative' ? 'alert' : 'status'} aria-live={tone === 'negative' ? 'assertive' : 'polite'} style={styles.inline}>
      <Icon name={tone === 'positive' ? 'check' : tone === 'warning' || tone === 'negative' ? 'warning' : 'info'} tone={tone} size="xs" />
      <Text variant="caption" tone={tone}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: {
    minWidth: 0,
    flexDirection: { compact: 'column', medium: 'row' },
    alignItems: { compact: 'stretch', medium: 'flex-start' },
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: theme.strokeWidths.standard,
  },
  content: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  copy: { minWidth: 0, flex: 1 },
  icon: {
    width: theme.feedbackMetrics.bannerIconBox,
    height: theme.feedbackMetrics.bannerIconBox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: {
    minWidth: 0,
    alignSelf: { compact: 'stretch', medium: 'center' },
  },
  tone_info: { backgroundColor: theme.colors.feedback.infoSurface, borderColor: theme.colors.feedback.infoSurface },
  tone_positive: { backgroundColor: theme.colors.feedback.positiveSurface, borderColor: theme.colors.feedback.positiveSurface },
  tone_warning: { backgroundColor: theme.colors.feedback.warningSurface, borderColor: theme.colors.feedback.warningSurface },
  tone_negative: { backgroundColor: theme.colors.feedback.negativeSurface, borderColor: theme.colors.feedback.negativeSurface },
  inline: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
}));
