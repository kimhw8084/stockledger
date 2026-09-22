import type { PropsWithChildren } from 'react';
import { Display, mq } from 'react-native-unistyles';
import { breakpoints, type BreakpointName } from '@expo-base/tokens';

export interface ResponsiveSlotProps extends PropsWithChildren {
  from?: BreakpointName;
  until?: BreakpointName;
}

export function ResponsiveSlot({ children, from, until }: ResponsiveSlotProps) {
  const minimum = from ? breakpoints[from] : 0;
  const maximum = until ? breakpoints[until] : undefined;
  return <Display mq={mq.only.width(minimum, maximum)}>{children}</Display>;
}
