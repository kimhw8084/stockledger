import React from "react";
import {
  Badge,
  Card,
  SegmentedControl,
  StyleSheet,
  Text,
  View,
  Pressable,
  VStack,
} from "../../ui";
import type { AppLanguage } from "../../lib/preferences";

export type EyeFlowsFilter = "All" | "Needs Review" | "Quiet";

export interface EyeFlowRow {
  id: string;
  stockId: string;
  recipeId: string;
  stockLabel: string;
  recipeLabel: string;
  thesisSnapshot: string;
  currentState: string;
  stateTone: "positive" | "warning" | "negative" | "neutral" | "info";
  whyNow: string;
  urgency: string;
  recipeVersion: string;
  lastReview: string;
  dataQuality?: string;
  needsReview: boolean;
}

interface EyeFlowsScreenProps {
  language: AppLanguage;
  filter: EyeFlowsFilter;
  onFilterChange: (filter: EyeFlowsFilter) => void;
  activeRows: EyeFlowRow[];
  quietRows: EyeFlowRow[];
  activeCount: number;
  quietCount: number;
  selectedEyeId?: string;
  focusRestoreRef?: React.RefObject<React.ComponentRef<typeof Pressable> | null>;
  fallbackFocusRef?: React.RefObject<React.ComponentRef<typeof Pressable> | null>;
  onCreate: () => void;
  onOpenEye: (eyeId: string, invoker?: unknown) => void;
}

const copy = (language: AppLanguage) => language === "ko" ? {
  description: "검토가 필요한 관찰 항목을 먼저 확인하고, 종목·레시피 맥락을 유지합니다.",
  active: "활성 관찰",
  quiet: "조용한 관찰",
  create: "관찰 항목 만들기",
  filters: ["전체", "검토 필요", "조용함"] as const,
  activeSection: (count: number) => `활성 관찰 ${count}개`,
  quietSection: (count: number) => `조용한 관찰 ${count}개`,
  activeNote: "현재 상태와 최근 평가의 이유를 검토합니다.",
  quietNote: "현재 관련성이 낮거나 논리가 깨진 기록입니다.",
  noActive: "활성 관찰 항목이 없습니다.",
  noQuiet: "조용한 관찰 항목이 없습니다.",
  needsReview: "검토 필요",
  quietLabel: "조용함",
  lastReview: "최근 검토",
  dataQuality: "데이터 품질",
} : {
  description: "Review Eyes that need attention first while keeping each stock and recipe context intact.",
  active: "Active Eyes",
  quiet: "Quiet Eyes",
  create: "Create Eye",
  filters: ["All", "Needs Review", "Quiet"] as const,
  activeSection: (count: number) => `Active Eyes · ${count}`,
  quietSection: (count: number) => `Quiet Eyes · ${count}`,
  activeNote: "Review current state and why the latest evaluation matters.",
  quietNote: "These records are currently not relevant or have a broken thesis.",
  noActive: "No active Eyes to show.",
  noQuiet: "No quiet Eyes to show.",
  needsReview: "Needs review",
  quietLabel: "Quiet",
  lastReview: "Last review",
  dataQuality: "Data quality",
};

export function EyeFlowsScreen({
  language,
  filter,
  onFilterChange,
  activeRows,
  quietRows,
  activeCount,
  quietCount,
  selectedEyeId,
  focusRestoreRef,
  fallbackFocusRef,
  onCreate,
  onOpenEye,
}: EyeFlowsScreenProps) {
  const text = copy(language);
  const [createFocused, setCreateFocused] = React.useState(false);
  const visibleActive = filter === "Quiet" ? [] : activeRows;
  const visibleQuiet = filter === "Needs Review" ? [] : quietRows;
  const options = text.filters.map((label, index) => ({
    value: (["All", "Needs Review", "Quiet"] as const)[index],
    label,
  }));
  const renderRow = (row: EyeFlowRow, isQuiet: boolean) => (
    <EyeFlowItem
      key={row.id}
      row={row}
      language={language}
      isQuiet={isQuiet}
      selected={row.id === selectedEyeId}
      focusRestoreRef={row.id === selectedEyeId ? focusRestoreRef : undefined}
      text={text}
      onOpenEye={onOpenEye}
    />
  );

  return (
    <View style={styles.root}>
    <VStack gap="lg">
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text variant="h2">{language === "ko" ? "관찰 항목" : "Eyes"}</Text>
          <Text tone="secondary">{text.description}</Text>
        </View>
      </View>

      <View style={styles.summary}>
        <Card variant="subtle" padding="compact">
          <View style={styles.summaryItem}>
            <Text variant="micro" tone="secondary">{text.active}</Text>
            <Text variant="h2" numeric>{activeCount}</Text>
          </View>
        </Card>
        <Card variant="subtle" padding="compact">
          <View style={styles.summaryItem}>
            <Text variant="micro" tone="secondary">{text.quiet}</Text>
            <Text variant="h2" numeric>{quietCount}</Text>
          </View>
        </Card>
      </View>

      <SegmentedControl
        label={language === "ko" ? "관찰 항목 필터" : "Eye review filter"}
        value={filter}
        options={options}
        onChange={(value) => onFilterChange(value as EyeFlowsFilter)}
      />

      {filter === "All" ? (
        <View>
          <Text variant="h3">{text.activeSection(visibleActive.length)}</Text>
          <Text variant="caption" tone="secondary">{text.activeNote}</Text>
          <View style={styles.list}>
            {visibleActive.length === 0 ? <Card variant="subtle"><Text tone="secondary">{text.noActive}</Text></Card> : visibleActive.map((row) => renderRow(row, false))}
            <Text variant="h3">{text.quietSection(visibleQuiet.length)}</Text>
            <Text variant="caption" tone="secondary">{text.quietNote}</Text>
            {visibleQuiet.length === 0 ? (
              <Card variant="subtle"><Text tone="secondary">{text.noQuiet}</Text></Card>
            ) : visibleQuiet.map((row) => renderRow(row, true))}
          </View>
        </View>
      ) : (
        <>
          <View>
            <Text variant="h3">{text.activeSection(visibleActive.length)}</Text>
            <Text variant="caption" tone="secondary">{text.activeNote}</Text>
            <View style={styles.list}>
              {visibleActive.length === 0 ? <Card variant="subtle"><Text tone="secondary">{text.noActive}</Text></Card> : visibleActive.map((row) => renderRow(row, false))}
            </View>
          </View>
          {filter !== "Needs Review" ? (
            <View>
              <Text variant="h3">{text.quietSection(visibleQuiet.length)}</Text>
              <Text variant="caption" tone="secondary">{text.quietNote}</Text>
              <View style={styles.list}>
                {visibleQuiet.length === 0 ? <Card variant="subtle"><Text tone="secondary">{text.noQuiet}</Text></Card> : visibleQuiet.map((row) => renderRow(row, true))}
              </View>
            </View>
          ) : null}
        </>
      )}

      <View style={styles.createAction}>
        <Pressable
          ref={fallbackFocusRef}
          accessibilityRole="button"
          accessibilityLabel={text.create}
          onPress={onCreate}
          onFocus={() => setCreateFocused(true)}
          onBlur={() => setCreateFocused(false)}
          style={[styles.createButton, createFocused ? styles.focused : null]}
        >
          <Text variant="label" tone="accent" align="center">{text.create}</Text>
        </Pressable>
      </View>
    </VStack>
    </View>
  );
}

function EyeFlowItem({
  row,
  language,
  isQuiet,
  selected,
  focusRestoreRef,
  text,
  onOpenEye,
}: {
  row: EyeFlowRow;
  language: AppLanguage;
  isQuiet: boolean;
  selected: boolean;
  focusRestoreRef?: React.RefObject<React.ComponentRef<typeof Pressable> | null>;
  text: ReturnType<typeof copy>;
  onOpenEye: (eyeId: string, invoker?: unknown) => void;
}) {
  const [focused, setFocused] = React.useState(false);
  return (
    <Card variant={selected ? "elevated" : "surface"} padding="compact">
      <View style={styles.item}>
        <Pressable
          ref={focusRestoreRef}
          accessibilityRole="button"
          accessibilityLabel={`${row.stockLabel} · ${row.recipeLabel} · ${row.currentState}`}
          accessibilityState={{ selected }}
          onPress={(event) => onOpenEye(row.id, event)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.openTarget, focused ? styles.focused : null]}
        >
          <View style={styles.itemBody}>
            <View style={styles.itemTop}>
              <View style={styles.itemIdentity}>
                <Text variant="h3">{row.stockLabel}</Text>
                <Text variant="micro" tone="secondary">{row.recipeLabel} · {row.recipeVersion}</Text>
              </View>
              <Badge label={isQuiet ? text.quietLabel : row.needsReview ? text.needsReview : text.active} tone={isQuiet ? "neutral" : row.needsReview ? "warning" : "info"} />
            </View>
            <View style={styles.badges}>
              <Badge label={row.currentState} tone={row.stateTone} />
              <Badge label={row.urgency} tone={row.needsReview ? "warning" : "neutral"} />
            </View>
            <Text variant="bodyLg">{row.whyNow}</Text>
            <Text variant="micro" tone="secondary">{text.lastReview}: {row.lastReview}</Text>
            <Text variant="caption" tone="secondary" numberOfLines={3}>{row.thesisSnapshot}</Text>
            {row.dataQuality ? <Text variant="micro" tone="secondary">{text.dataQuality}: {row.dataQuality}</Text> : null}
          </View>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { minWidth: 0 },
  header: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "center" }, justifyContent: "space-between", gap: theme.spacing.md },
  headerCopy: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  summary: { minWidth: 0, flexDirection: "row", gap: theme.spacing.sm },
  summaryItem: { minWidth: 0, gap: theme.spacing.xxs },
  list: { minWidth: 0, gap: theme.spacing.sm, marginTop: theme.spacing.md },
  item: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "center" }, gap: theme.spacing.md },
  openTarget: { minWidth: 0, flex: 1, paddingVertical: theme.spacing.xs, paddingHorizontal: theme.spacing.xs, borderRadius: theme.radii.sm },
  focused: { borderWidth: 3, borderColor: theme.colors.border.focus },
  itemBody: { minWidth: 0, gap: theme.spacing.xs },
  itemTop: { minWidth: 0, flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: theme.spacing.sm },
  itemIdentity: { minWidth: 0, flex: 1, gap: theme.spacing.xxs },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
  createAction: { alignItems: { compact: "stretch", medium: "flex-end" } },
  createButton: { minWidth: 0, minHeight: theme.controlHeights.md, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderWidth: theme.strokeWidths.standard, borderColor: theme.colors.border.default, borderRadius: theme.radii.md, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background.surface },
}));
