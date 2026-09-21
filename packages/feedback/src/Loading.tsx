import { ActivityIndicator, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Text, VStack } from '@expo-base/primitives';

export function LoadingState({ label = 'Loading…' }: { label?: string | undefined }) {
  const { theme } = useUnistyles();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      role="progressbar"
      aria-label={label}
      style={styles.loading}
    >
      <VStack align="center" gap="md">
        <ActivityIndicator color={theme.colors.interactive.primary} />
        <Text variant="caption" tone="secondary">{label}</Text>
      </VStack>
    </View>
  );
}

export type SkeletonWidth = 'full' | 'medium' | 'short';

export function SkeletonLine({ width = 'full', title = false }: { width?: SkeletonWidth; title?: boolean }) {
  return <View accessible={false} style={[styles.skeleton, title && styles.skeletonTitle, styles[`width_${width}`]]} />;
}

export function SkeletonList({ rows = 4, label = 'Loading content' }: { rows?: number; label?: string }) {
  const count = Math.max(1, Math.min(12, Math.trunc(rows)));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      role="progressbar"
      aria-label={label}
      style={styles.skeletonList}
    >
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.skeletonRow}>
          <View accessible={false} style={styles.skeletonAvatar} />
          <View style={styles.skeletonText}>
            <SkeletonLine title width={index % 2 === 0 ? 'medium' : 'short'} />
            <SkeletonLine width="full" />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  loading: {
    minWidth: 0,
    minHeight: theme.feedbackMetrics.stateMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeleton: {
    height: theme.feedbackMetrics.skeletonLineHeight,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.feedback.skeleton,
  },
  skeletonTitle: { height: theme.feedbackMetrics.skeletonTitleHeight },
  width_full: { width: '100%' },
  width_medium: { width: '72%' },
  width_short: { width: '48%' },
  skeletonList: { minWidth: 0, gap: theme.spacing.lg },
  skeletonRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  skeletonAvatar: {
    width: theme.feedbackMetrics.skeletonAvatar,
    height: theme.feedbackMetrics.skeletonAvatar,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.feedback.skeleton,
  },
  skeletonText: { minWidth: 0, flex: 1, gap: theme.spacing.sm },
}));
