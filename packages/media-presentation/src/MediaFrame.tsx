import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, type ImageResizeMode, type ImageSourcePropType, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '@expo-base/icons';
import { Text, VStack } from '@expo-base/primitives';

export type MediaFrameState = 'loading' | 'ready' | 'error' | 'empty';
export type MediaFrameSource = ImageSourcePropType | string | null | undefined;

export interface MediaFrameProps {
  source?: MediaFrameSource;
  alt?: string | undefined;
  decorative?: boolean;
  aspectRatio?: number;
  fit?: ImageResizeMode;
  state?: MediaFrameState | undefined;
  loadingLabel?: string;
  errorLabel?: string;
  emptyLabel?: string;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  fallback?: ReactNode;
  testID?: string | undefined;
  onLoad?: (() => void) | undefined;
  onError?: (() => void) | undefined;
}

/**
 * Dependency-free media presentation. Acquisition, upload, and provider URL
 * resolution stay outside this owner so generated minimal apps remain lean.
 */
export function MediaFrame({
  source,
  alt,
  decorative = false,
  aspectRatio = 16 / 9,
  fit = 'cover',
  state: stateOverride,
  loadingLabel = 'Loading media',
  errorLabel = 'Unable to load media',
  emptyLabel = 'No media available',
  rounded = 'md',
  fallback,
  testID,
  onLoad,
  onError,
}: MediaFrameProps) {
  const { theme } = useUnistyles();
  const initial = source ? 'loading' : 'empty';
  const [internalState, setInternalState] = useState<MediaFrameState>(initial);
  useEffect(() => { setInternalState(source ? 'loading' : 'empty'); }, [source]);
  const state = stateOverride ?? internalState;
  const imageSource = normalizeSource(source);
  const accessible = !decorative && Boolean(alt);
  return (
    <View
      accessible={accessible}
      accessibilityRole={accessible ? 'image' : undefined}
      role={accessible ? 'img' : undefined}
      accessibilityLabel={accessible ? alt : undefined}
      aria-label={accessible ? alt : undefined}
      style={[styles.frame, styles[`rounded_${rounded}`], { aspectRatio: Math.max(0.1, aspectRatio) }]}
      testID={testID}
    >
      {imageSource && state !== 'empty' ? <Image source={imageSource} resizeMode={fit} accessible={false} style={styles.image} onLoad={() => { setInternalState('ready'); onLoad?.(); }} onError={() => { setInternalState('error'); onError?.(); }} /> : null}
      {state === 'loading' ? <MediaStatus label={loadingLabel} busy color={theme.colors.interactive.primary} /> : null}
      {state === 'error' ? fallback ? <MediaFallback>{fallback}</MediaFallback> : <MediaStatus label={errorLabel} icon="closeCircle" /> : null}
      {state === 'empty' ? fallback ? <MediaFallback>{fallback}</MediaFallback> : <MediaStatus label={emptyLabel} icon="image" /> : null}
    </View>
  );
}

function MediaFallback({ children }: { children: ReactNode }) {
  return <View style={styles.status}>{children}</View>;
}

function MediaStatus({ label, busy = false, icon, color }: { label: string; busy?: boolean; icon?: 'closeCircle' | 'image'; color?: string }) {
  return <View accessibilityLiveRegion="polite" aria-live="polite" style={styles.status}><VStack gap="xs" align="center">{busy ? <ActivityIndicator color={color} /> : icon ? <Icon name={icon} size="md" tone={icon === 'closeCircle' ? 'negative' : 'tertiary'} /> : null}<Text variant="caption" tone="secondary" align="center">{label}</Text></VStack></View>;
}

function normalizeSource(source: MediaFrameSource): ImageSourcePropType | undefined {
  return typeof source === 'string' ? { uri: source } : source ?? undefined;
}

const styles = StyleSheet.create((theme) => ({
  frame: { minWidth: 0, width: '100%', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background.subtle, borderWidth: theme.strokeWidths.standard, borderColor: theme.colors.border.subtle },
  image: { width: '100%', height: '100%' },
  status: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.md, backgroundColor: theme.colors.background.subtle },
  rounded_none: { borderRadius: theme.radii.none },
  rounded_sm: { borderRadius: theme.radii.sm },
  rounded_md: { borderRadius: theme.radii.md },
  rounded_lg: { borderRadius: theme.radii.lg },
  rounded_full: { borderRadius: theme.radii.full },
}));
