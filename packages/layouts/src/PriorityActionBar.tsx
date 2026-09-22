import { Children, cloneElement, isValidElement, useEffect, useMemo, useState, type Dispatch, type ReactElement, type ReactNode, type SetStateAction } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { actionMetrics, spacing, type OverflowTriggerSize } from '@expo-base/tokens';
import { solveActionOverflow, type ActionPriority } from '@expo-base/platform';

export interface PriorityActionProps {
  actionKey: string;
  priority?: ActionPriority;
  children: ReactElement;
}

export function PriorityAction({ children }: PriorityActionProps) {
  return children;
}

export interface PriorityActionBarProps {
  children: ReactNode;
  renderOverflow: (hiddenKeys: readonly string[]) => ReactNode;
  overflowTriggerSize?: OverflowTriggerSize;
  gap?: 'sm' | 'md' | 'lg';
  onCapacityViolation?: (requiredKeys: readonly string[]) => void;
}

interface ActionDescriptor {
  key: string;
  priority: ActionPriority;
  element: ReactElement;
  order: number;
}

export function PriorityActionBar({
  children,
  renderOverflow,
  overflowTriggerSize = 'standard',
  gap = 'sm',
  onCapacityViolation,
}: PriorityActionBarProps) {
  const descriptors = useMemo(() => extractActions(children), [children]);
  const [availableWidth, setAvailableWidth] = useState(0);
  const [measurements, setMeasurements] = useState<Record<string, number>>({});

  const measuredAll = descriptors.length === 0 || descriptors.every((item) => measurements[item.key] !== undefined);
  const result = measuredAll && availableWidth > 0
    ? solveActionOverflow({
        availableWidth,
        gap: spacing[gap],
        overflowTriggerWidth: actionMetrics.overflowTrigger[overflowTriggerSize],
        actions: descriptors.map((item) => ({
          key: item.key,
          priority: item.priority,
          width: measurements[item.key] ?? 0,
          order: item.order,
        })),
      })
    : null;

  const visibleKeys = new Set(result?.visibleKeys ?? descriptors.filter((item) => item.priority === 'required').map((item) => item.key));
  const hiddenKeys = result?.overflowKeys ?? descriptors.filter((item) => item.priority !== 'required').map((item) => item.key);

  useEffect(() => {
    if (!result?.capacityExceeded || !onCapacityViolation) return;
    onCapacityViolation(descriptors.filter((item) => item.priority === 'required').map((item) => item.key));
  }, [descriptors, onCapacityViolation, result?.capacityExceeded]);

  return (
    <View style={styles.root} onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}>
      <View style={[styles.visibleRow, styles[`gap_${gap}`], result?.capacityExceeded && styles.wrap, !measuredAll && styles.pending]}>
        {descriptors.filter((item) => visibleKeys.has(item.key)).map((item) => cloneElement(item.element, { key: item.key }))}
        {hiddenKeys.length > 0 ? renderOverflow(hiddenKeys) : null}
      </View>

      {!measuredAll ? (
        <View style={[styles.measureRail, styles[`gap_${gap}`]]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {descriptors.map((item) => (
            <View key={item.key} onLayout={(event) => recordMeasurement(item.key, event, setMeasurements)}>
              {item.element}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function extractActions(children: ReactNode): ActionDescriptor[] {
  const output: ActionDescriptor[] = [];
  Children.forEach(children, (child, order) => {
    if (!isValidElement<PriorityActionProps>(child) || child.type !== PriorityAction) return;
    output.push({
      key: child.props.actionKey,
      priority: child.props.priority ?? 'preferred',
      element: child.props.children,
      order,
    });
  });
  return output;
}

function recordMeasurement(
  key: string,
  event: LayoutChangeEvent,
  setMeasurements: Dispatch<SetStateAction<Record<string, number>>>,
) {
  const width = Math.ceil(event.nativeEvent.layout.width);
  setMeasurements((current) => current[key] === width ? current : { ...current, [key]: width });
}

const styles = StyleSheet.create((theme) => ({
  root: {
    minWidth: 0,
    width: { compact: '100%', medium: theme.actionMetrics.barWidth.medium, expanded: theme.actionMetrics.barWidth.expanded, wide: theme.actionMetrics.barWidth.wide },
    maxWidth: '100%',
    position: 'relative',
    minHeight: theme.controlHeights.md,
    overflow: 'hidden',
  },
  visibleRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  gap_sm: { gap: theme.spacing.sm },
  gap_md: { gap: theme.spacing.md },
  gap_lg: { gap: theme.spacing.lg },
  wrap: { flexWrap: 'wrap' },
  pending: { opacity: 0 },
  measureRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    opacity: 0,
    pointerEvents: 'none',
    flexDirection: 'row',
    alignItems: 'center',
  },
}));
