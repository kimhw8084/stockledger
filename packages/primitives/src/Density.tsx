import { createContext, useContext, type PropsWithChildren } from 'react';
import type { SpacingToken } from '@expo-base/tokens';

export type ExpoBaseDensity = 'comfortable' | 'compact';
const DensityContext = createContext<ExpoBaseDensity>('comfortable');

export function DensityProvider({ density, children }: PropsWithChildren<{ density: ExpoBaseDensity }>) {
  return <DensityContext.Provider value={density}>{children}</DensityContext.Provider>;
}

export function useDensity(): ExpoBaseDensity {
  return useContext(DensityContext);
}

export function densitySpacingToken(token: Exclude<SpacingToken, 'none' | 'xxs'>, density: ExpoBaseDensity): Exclude<SpacingToken, 'none' | 'xxs'> {
  if (density === 'comfortable') return token;
  const compact: Record<Exclude<SpacingToken, 'none' | 'xxs'>, Exclude<SpacingToken, 'none' | 'xxs'>> = {
    xs: 'xs', sm: 'sm', md: 'sm', lg: 'md', xl: 'lg', xxl: 'xl', xxxl: 'xxl', huge: 'xxxl', massive: 'huge',
  };
  return compact[token];
}
