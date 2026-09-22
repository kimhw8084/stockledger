import type { IconName } from '@expo-base/icons';
import { Icon } from '@expo-base/icons';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Button } from '@expo-base/components';
import { Text, VStack } from '@expo-base/primitives';

export type StateKind = 'empty' | 'noResults' | 'error' | 'offline' | 'permission' | 'reconnect' | 'maintenance';

const defaults: Record<StateKind, { icon: IconName; title: string; message: string }> = {
  empty: { icon: 'plus', title: 'Nothing here yet', message: 'Create or connect something to get started.' },
  noResults: { icon: 'search', title: 'No matching results', message: 'Change your filters or broaden your search.' },
  error: { icon: 'warning', title: 'Something went wrong', message: 'Try again. If the problem continues, the service may be temporarily unavailable.' },
  offline: { icon: 'warning', title: 'You are offline', message: 'Check your connection. Previously loaded information may still be available.' },
  permission: { icon: 'lock', title: 'Permission required', message: 'Grant the required access to continue this workflow.' },
  reconnect: { icon: 'refresh', title: 'Connection needs attention', message: 'Reconnect this source to resume automatic updates.' },
  maintenance: { icon: 'settings', title: 'Temporarily unavailable', message: 'This area is undergoing maintenance. Try again later.' },
};

export interface StateViewProps {
  kind: StateKind;
  title?: string | undefined;
  message?: string | undefined;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  actionLoading?: boolean | undefined;
  secondaryLabel?: string | undefined;
  onSecondary?: (() => void) | undefined;
}

export function StateView({ kind, title, message, actionLabel, onAction, actionLoading = false, secondaryLabel, onSecondary }: StateViewProps) {
  const state = defaults[kind];
  const warningSurface = kind === 'offline' || kind === 'reconnect';
  return (
    <View
      accessibilityRole={kind === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion={kind === 'error' ? 'assertive' : 'polite'}
      role={kind === 'error' ? 'alert' : 'status'}
      aria-live={kind === 'error' ? 'assertive' : 'polite'}
      style={styles.root}
    >
      <View style={[styles.icon, kind === 'error' && styles.icon_error, warningSurface && styles.icon_warning]}>
        <Icon
          name={state.icon}
          size="lg"
          tone={kind === 'error' ? 'negative' : warningSurface ? 'warning' : 'secondary'}
        />
      </View>
      <View style={styles.copy}>
        <VStack align="center" gap="sm">
          <Text variant="h3" align="center">{title ?? state.title}</Text>
          <Text tone="secondary" align="center">{message ?? state.message}</Text>
        </VStack>
      </View>
      {actionLabel && onAction || secondaryLabel && onSecondary ? (
        <View style={styles.actions}>
          {secondaryLabel && onSecondary ? (
            <Button label={secondaryLabel} variant="secondary" responsiveWidth="compact-full" onPress={onSecondary} />
          ) : null}
          {actionLabel && onAction ? (
            <Button label={actionLabel} responsiveWidth="compact-full" loading={actionLoading} onPress={onAction} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    minWidth: 0,
    minHeight: theme.feedbackMetrics.stateMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xxl,
    gap: theme.spacing.lg,
  },
  icon: {
    width: theme.feedbackMetrics.stateIconBox,
    height: theme.feedbackMetrics.stateIconBox,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.background.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon_error: { backgroundColor: theme.colors.feedback.negativeSurface },
  icon_warning: { backgroundColor: theme.colors.feedback.warningSurface },
  copy: {
    minWidth: 0,
    width: '100%',
    maxWidth: theme.layoutDimensions.compactReadable,
  },
  actions: {
    minWidth: 0,
    width: '100%',
    maxWidth: theme.contentWidths.form,
    flexDirection: { compact: 'column-reverse', medium: 'row' },
    justifyContent: 'center',
    alignItems: { compact: 'stretch', medium: 'center' },
    gap: theme.spacing.sm,
  },
}));
