import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '@expo-base/primitives';
import { MediaFrame, type MediaFrameSource } from '@expo-base/media-presentation';

export interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  shape?: 'circle' | 'rounded';
  source?: MediaFrameSource;
  decorative?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function Avatar({ name, size = 'md', shape = 'circle', source, decorative = false, accessibilityLabel, testID }: AvatarProps) {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const initials = normalizedName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
  const label = accessibilityLabel ?? `${normalizedName || 'User'} avatar`;
  return (
    <View
      role="img"
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      accessibilityLabel={decorative ? undefined : label}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      style={[styles.base, styles[size], shape === 'circle' ? styles.circle : styles.rounded]}
      testID={testID}
    >
      <MediaFrame source={source} alt={label} decorative aspectRatio={1} rounded={shape === 'circle' ? 'full' : 'lg'} fallback={<Text variant={size === 'lg' ? 'label' : 'micro'}>{initials}</Text>} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  base: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  circle: { borderRadius: theme.radii.full },
  rounded: { borderRadius: theme.radii.lg },
  sm: { width: theme.controlHeights.sm, height: theme.controlHeights.sm },
  md: { width: theme.controlHeights.md, height: theme.controlHeights.md },
  lg: { width: theme.controlHeights.lg, height: theme.controlHeights.lg },
}));
