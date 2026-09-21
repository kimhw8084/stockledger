import { View, type ViewProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '@expo-base/primitives';

type Tone = 'neutral' | 'positive' | 'warning' | 'negative' | 'info';

export interface BadgeProps { label: string; tone?: Tone; testID?: ViewProps['testID']; }

export function Badge({ label, tone = 'neutral', testID }: BadgeProps) {
  return <View testID={testID} style={[styles.base, styles[tone]]}><Text variant="micro" tone={tone === 'neutral' ? 'secondary' : tone}>{label}</Text></View>;
}

const styles = StyleSheet.create((theme) => ({
  base: { minHeight: theme.componentMetrics.badgeHeight, paddingHorizontal: theme.spacing.sm, borderRadius: theme.radii.full, justifyContent: 'center', alignSelf: 'flex-start' },
  neutral: { backgroundColor: theme.colors.background.subtle },
  positive: { backgroundColor: theme.colors.feedback.positiveSurface },
  warning: { backgroundColor: theme.colors.feedback.warningSurface },
  negative: { backgroundColor: theme.colors.feedback.negativeSurface },
  info: { backgroundColor: theme.colors.feedback.infoSurface },
}));
