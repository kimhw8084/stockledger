import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '@expo-base/icons';
import { Text, VStack, useInteractionState } from '@expo-base/primitives';

export interface DisclosureProps {
  id: string;
  title: string;
  description?: string | undefined;
  expanded?: boolean | undefined;
  defaultExpanded?: boolean;
  onExpandedChange?: ((expanded: boolean) => void) | undefined;
  disabled?: boolean;
  children: ReactNode;
  testID?: string | undefined;
}

/** A controlled-or-uncontrolled semantic disclosure for optional supporting content. */
export function Disclosure({
  id,
  title,
  description,
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  disabled = false,
  children,
  testID,
}: DisclosureProps) {
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded);
  const isExpanded = expanded ?? uncontrolledExpanded;
  const { hovered, focused, interactionProps } = useInteractionState();
  const contentId = `${id}-content`;
  const setExpanded = (next: boolean) => {
    if (expanded === undefined) setUncontrolledExpanded(next);
    onExpandedChange?.(next);
  };

  return (
    <View style={styles.root} testID={testID}>
      <Pressable
        accessibilityRole="button"
        role="button"
        accessibilityLabel={title}
        accessibilityHint={description}
        accessibilityState={{ expanded: isExpanded, disabled }}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        aria-disabled={disabled}
        disabled={disabled}
        onPress={() => setExpanded(!isExpanded)}
        {...interactionProps}
        style={({ pressed }) => [
          styles.trigger,
          hovered && !disabled && styles.hovered,
          focused && styles.focused,
          pressed && !disabled && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <View style={styles.copy}>
          <VStack gap="xs"><Text variant="label">{title}</Text>{description ? <Text variant="caption" tone="secondary">{description}</Text> : null}</VStack>
        </View>
        <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} size="sm" tone="secondary" />
      </Pressable>
      {isExpanded ? <View id={contentId} style={styles.content}>{children}</View> : null}
    </View>
  );
}

export interface AccordionItem {
  id: string;
  title: string;
  description?: string | undefined;
  content: ReactNode;
  disabled?: boolean | undefined;
}

export interface AccordionProps {
  items: readonly AccordionItem[];
  expandedIds?: readonly string[] | undefined;
  defaultExpandedIds?: readonly string[];
  onExpandedChange?: ((ids: readonly string[]) => void) | undefined;
  multiple?: boolean;
  testID?: string | undefined;
}

/** A small composition over Disclosure for related expandable sections. */
export function Accordion({ items, expandedIds, defaultExpandedIds = [], onExpandedChange, multiple = false, testID }: AccordionProps) {
  const [uncontrolledIds, setUncontrolledIds] = useState<readonly string[]>(defaultExpandedIds);
  const currentIds = expandedIds ?? uncontrolledIds;
  const update = (itemId: string, nextExpanded: boolean) => {
    const nextIds = nextExpanded
      ? multiple ? [...new Set([...currentIds, itemId])] : [itemId]
      : currentIds.filter((id) => id !== itemId);
    if (expandedIds === undefined) setUncontrolledIds(nextIds);
    onExpandedChange?.(nextIds);
  };
  return (
    <View accessibilityRole="list" role="list" style={styles.accordion} testID={testID}>
      {items.map((item) => (
        <View key={item.id} role="listitem" style={styles.item}>
          <Disclosure
            id={item.id}
            title={item.title}
            description={item.description}
            expanded={currentIds.includes(item.id)}
            onExpandedChange={(next) => update(item.id, next)}
            {...(item.disabled === undefined ? {} : { disabled: item.disabled })}
          >
            {item.content}
          </Disclosure>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { minWidth: 0, borderWidth: theme.strokeWidths.standard, borderColor: theme.colors.border.subtle, borderRadius: theme.radii.md, backgroundColor: theme.colors.background.surface, overflow: 'hidden' },
  trigger: { minWidth: 0, minHeight: theme.controlHeights.md, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
  copy: { minWidth: 0, flex: 1 },
  content: { minWidth: 0, paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md, borderTopWidth: theme.strokeWidths.standard, borderTopColor: theme.colors.border.subtle },
  hovered: { backgroundColor: theme.colors.background.subtle },
  focused: { boxShadow: `0 0 0 ${theme.interactionFeedback.focusRingWidth}px ${theme.colors.border.focus}` },
  pressed: { opacity: theme.interactionFeedback.pressedOpacity },
  disabled: { opacity: theme.interactionFeedback.disabledOpacity },
  accordion: { minWidth: 0, gap: theme.spacing.sm },
  item: { minWidth: 0 },
}));
