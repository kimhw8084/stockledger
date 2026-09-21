import type { PropsWithChildren, ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import type { ContentWidth } from '@expo-base/tokens';
import { useDensity } from '@expo-base/primitives';
import { Container } from './Container';

export interface PageProps extends PropsWithChildren {
  width?: ContentWidth;
  header?: ReactNode;
  footer?: ReactNode;
}

export function Page({ children, width = 'standard', header, footer }: PageProps) {
  const density = useDensity();
  return (
    <Container width={width}>
      <View style={[styles.page, density === 'compact' && styles.pageCompact]}>
        {header}
        <View style={[styles.content, density === 'compact' && styles.contentCompact]}>{children}</View>
        {footer}
      </View>
    </Container>
  );
}

export function Section({ children }: PropsWithChildren) {
  const density = useDensity();
  return <View style={[styles.section, density === 'compact' && styles.sectionCompact]}>{children}</View>;
}

const styles = StyleSheet.create((theme) => ({
  page: { minWidth: 0, gap: { compact: theme.spacing.xl, medium: theme.spacing.xxl, wide: theme.spacing.xxxl } },
  pageCompact: { gap: { compact: theme.spacing.lg, medium: theme.spacing.xl, wide: theme.spacing.xxl } },
  content: { minWidth: 0, gap: theme.spacing.xl },
  contentCompact: { gap: theme.spacing.lg },
  section: { minWidth: 0, gap: theme.spacing.lg },
  sectionCompact: { gap: theme.spacing.md },
}));
