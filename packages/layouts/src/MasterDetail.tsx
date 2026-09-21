import type { ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { ResponsiveSlot } from './Responsive';

export interface MasterDetailProps {
  master: ReactNode;
  detail: ReactNode;
  masterWidth?: 'narrow' | 'standard';
  compactMode?: 'master' | 'detail' | 'stack';
}

export function MasterDetail({ master, detail, masterWidth = 'standard', compactMode = 'master' }: MasterDetailProps) {
  const compactContent = compactMode === 'master' ? master : compactMode === 'detail' ? detail : (
    <View style={styles.compactStack}>
      {master}
      {detail}
    </View>
  );

  return (
    <>
      <ResponsiveSlot until="expanded">
        <View style={styles.compact}>{compactContent}</View>
      </ResponsiveSlot>
      <ResponsiveSlot from="expanded">
        <View style={styles.expandedRoot}>
          <View style={[styles.master, styles[`master_${masterWidth}`]]}>{master}</View>
          <View style={styles.detail}>{detail}</View>
        </View>
      </ResponsiveSlot>
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  compact: { minWidth: 0 },
  compactStack: { minWidth: 0, gap: theme.spacing.lg },
  expandedRoot: { minWidth: 0, flexDirection: 'row', gap: theme.spacing.xl },
  master: { minWidth: 0, flexShrink: 0 },
  master_narrow: { width: theme.layoutDimensions.split.secondaryMinimum },
  master_standard: { width: theme.layoutDimensions.split.primaryMinimum },
  detail: { minWidth: 0, flex: 1 },
}));
