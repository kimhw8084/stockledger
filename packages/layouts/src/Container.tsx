import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { ContentWidth } from '@expo-base/tokens';

export function Container({ children, width = 'standard' }: PropsWithChildren<{ width?: ContentWidth }>) {
  return <View style={[styles.base, styles[width]]}>{children}</View>;
}

const styles = StyleSheet.create((theme) => ({
  base: { width: '100%', alignSelf: 'center', minWidth: 0 },
  reading: { maxWidth: theme.contentWidths.reading },
  form: { maxWidth: theme.contentWidths.form },
  standard: { maxWidth: theme.contentWidths.standard },
  dashboard: { maxWidth: theme.contentWidths.dashboard },
  wide: { maxWidth: theme.contentWidths.wide },
}));
