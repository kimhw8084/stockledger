import type { PropsWithChildren } from 'react';
import { KeyboardProvider } from 'react-native-keyboard-controller';

export function KeyboardRootProvider({ children }: PropsWithChildren) {
  return <KeyboardProvider>{children}</KeyboardProvider>;
}
