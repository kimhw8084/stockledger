import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text, HStack } from '@expo-base/primitives';
import { Icon, type IconName } from '@expo-base/icons';

export type TagTone = 'neutral' | 'positive' | 'warning' | 'negative' | 'info';
export interface TagProps { label: string; tone?: TagTone; icon?: IconName; }

export function Tag({ label, tone = 'neutral', icon }: TagProps) {
  return (
    <View style={[styles.base, styles[`tone_${tone}`]]}>
      <HStack gap="xs" align="center">
        {icon ? <Icon name={icon} size="xs" tone={tone === 'neutral' ? 'secondary' : tone} /> : null}
        <Text variant="micro" tone={tone === 'neutral' ? 'secondary' : tone}>{label}</Text>
      </HStack>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: { alignSelf: 'flex-start', minHeight: theme.componentMetrics.tagHeight, paddingHorizontal: theme.spacing.sm, justifyContent: 'center', borderRadius: theme.radii.full },
  tone_neutral: { backgroundColor: theme.colors.background.subtle },
  tone_positive: { backgroundColor: theme.colors.feedback.positiveSurface },
  tone_warning: { backgroundColor: theme.colors.feedback.warningSurface },
  tone_negative: { backgroundColor: theme.colors.feedback.negativeSurface },
  tone_info: { backgroundColor: theme.colors.feedback.infoSurface },
}));
