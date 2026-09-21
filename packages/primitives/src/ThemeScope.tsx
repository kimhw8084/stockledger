import type { PropsWithChildren } from 'react';
import { ScopedTheme } from 'react-native-unistyles';
import type { ThemeName } from '@expo-base/tokens';

export function ThemeScope({ name, children }: PropsWithChildren<{ name: ThemeName }>) {
  return <ScopedTheme name={name}>{children}</ScopedTheme>;
}
