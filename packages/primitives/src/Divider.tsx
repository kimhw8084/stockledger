import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export interface DividerProps {
  strength?: 'subtle' | 'default' | 'strong';
  orientation?: 'horizontal' | 'vertical';
  inset?: 'none' | 'start' | 'both';
}

export function Divider({ strength = 'subtle', orientation = 'horizontal', inset = 'none' }: DividerProps) {
  return <View accessibilityRole="none" style={[styles[orientation], styles[strength], inset !== 'none' && styles[`inset_${inset}`]]} />;
}

const styles = StyleSheet.create((theme) => ({
  horizontal: { width: '100%', height: theme.strokeWidths.standard, flexShrink: 0 },
  vertical: { width: theme.strokeWidths.standard, alignSelf: 'stretch', flexShrink: 0 },
  inset_start: { marginStart: theme.spacing.lg },
  inset_both: { marginHorizontal: theme.spacing.lg, width: 'auto' },
  subtle: { backgroundColor: theme.colors.border.subtle },
  default: { backgroundColor: theme.colors.border.default },
  strong: { backgroundColor: theme.colors.border.strong },
}));
