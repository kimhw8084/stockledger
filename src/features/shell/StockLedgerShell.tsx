import React from "react";
import { useWorkspaceNavigation, type WorkspaceTab } from "../../hooks/useWorkspaceNavigation";
import {
  Badge,
  Divider,
  Icon,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "../../ui";

export interface StockLedgerShellProps {
  language: "en" | "ko";
  tab: WorkspaceTab;
  tabLabels: Record<WorkspaceTab, string>;
  subtitle: string;
  openAlerts: number;
  onSelect: (tab: WorkspaceTab) => void;
  onOpenAlerts: () => void;
  onOpenSettings: () => void;
  navigationFocusRefs?: Partial<Record<"Home" | "Stocks" | "Logic Lab" | "Journal", React.RefObject<any>>>;
  alertsRef?: React.RefObject<any>;
  settingsRef?: React.RefObject<any>;
  children: React.ReactNode;
}

const navigationItems: Array<{ key: "Home" | "Stocks" | "Logic Lab" | "Journal"; icon: "home" | "arrowUpDown" | "edit" | "receipt" }> = [
  { key: "Home", icon: "home" },
  { key: "Stocks", icon: "arrowUpDown" },
  { key: "Logic Lab", icon: "edit" },
  { key: "Journal", icon: "receipt" },
];

function Navigation({ props }: { props: StockLedgerShellProps }) {
  return (
    <View style={styles.navigation}>
      <View style={styles.brand}>
        <View style={styles.brandMark}><Text variant="label" tone="onPrimary" align="center">S</Text></View>
        <View style={styles.brandCopy}>
          <Text variant="label">StockLedger</Text>
          <Text variant="caption" tone="secondary">{props.language === "ko" ? "근거 중심 검토" : "Evidence-led review"}</Text>
        </View>
      </View>
      <Divider />
      <View accessibilityRole="tablist" accessibilityLabel={props.language === "ko" ? "주요 탐색" : "Primary navigation"} style={styles.navigationItems}>
        {navigationItems.map((item) => {
          const selected = props.tab === item.key;
          return (
            <Pressable
              key={item.key}
              ref={props.navigationFocusRefs?.[item.key]}
              accessibilityRole="tab"
              accessibilityLabel={props.tabLabels[item.key]}
              accessibilityState={{ selected }}
              aria-selected={selected}
              onPress={() => props.onSelect(item.key)}
              style={({ pressed }) => [styles.navigationItem, selected && styles.navigationItemSelected, pressed && styles.navigationItemPressed]}
            >
              <Icon name={item.icon} size="sm" tone={selected ? "accent" : "secondary"} />
              <Text variant="label" tone={selected ? "accent" : "secondary"} numberOfLines={1}>{props.tabLabels[item.key]}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.navigationFooter}>
        <Text variant="micro" tone="tertiary">{props.language === "ko" ? "작업 공간" : "Workspace"}</Text>
        <Text variant="caption" tone="secondary">{props.language === "ko" ? "관찰 → 근거 → 기록" : "Observe → inspect → record"}</Text>
      </View>
    </View>
  );
}

export function StockLedgerShell(props: StockLedgerShellProps) {
  return (
    <View style={styles.root} nativeID="stockledger-shell">
      <Navigation props={props} />
      <View style={styles.content}>
        <View style={styles.topBar}>
          <View style={styles.topBarCopy}>
            <Text variant="h2">{props.tabLabels[props.tab]}</Text>
            <Text variant="caption" tone="secondary">{props.subtitle}</Text>
          </View>
          <View style={styles.topBarActions}>
            <Pressable
              ref={props.alertsRef}
              accessibilityRole="button"
              accessibilityLabel={props.language === "ko" ? "알림" : "Alerts"}
              accessibilityState={{ selected: props.tab === "Alerts" }}
              aria-pressed={props.tab === "Alerts"}
              onPress={props.onOpenAlerts}
              style={({ pressed }) => [styles.utilityButton, props.tab === "Alerts" && styles.utilityButtonSelected, pressed && styles.navigationItemPressed]}
            >
              <Icon name="bell" size="md" tone={props.tab === "Alerts" ? "accent" : "secondary"} />
            </Pressable>
            {props.openAlerts > 0 ? <Badge label={String(props.openAlerts)} tone="negative" /> : null}
            <Pressable
              ref={props.settingsRef}
              accessibilityRole="button"
              accessibilityLabel={props.tabLabels.Settings}
              accessibilityState={{ selected: props.tab === "Settings" }}
              aria-pressed={props.tab === "Settings"}
              onPress={props.onOpenSettings}
              style={({ pressed }) => [styles.utilityButton, props.tab === "Settings" && styles.utilityButtonSelected, pressed && styles.navigationItemPressed]}
            >
              <Icon name="settings" size="md" tone={props.tab === "Settings" ? "accent" : "secondary"} />
            </Pressable>
          </View>
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {props.children}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, minWidth: 0, position: "relative", backgroundColor: theme.colors.background.canvas },
  content: { flex: 1, minWidth: 0, paddingBottom: { compact: 86, expanded: 0 }, paddingStart: { compact: 0, expanded: 224 } },
  navigation: {
    position: "absolute",
    zIndex: theme.layers.navigation,
    left: 0,
    right: { compact: 0, expanded: "auto" },
    bottom: { compact: 0, expanded: 0 },
    top: { compact: "auto", expanded: 0 },
    width: { compact: "100%", expanded: 224 },
    minHeight: { compact: 86, expanded: "100%" },
    paddingHorizontal: { compact: theme.spacing.sm, expanded: theme.spacing.lg },
    paddingVertical: { compact: theme.spacing.sm, expanded: theme.spacing.xl },
    gap: theme.spacing.lg,
    backgroundColor: theme.colors.background.surface,
    borderTopWidth: { compact: theme.strokeWidths.standard, expanded: 0 },
    borderRightWidth: { compact: 0, expanded: theme.strokeWidths.standard },
    borderColor: theme.colors.border.subtle,
    ...theme.elevation.low,
  },
  brand: { display: { compact: "none", expanded: "flex" }, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  brandMark: { width: 32, height: 32, borderRadius: theme.radii.sm, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.interactive.primary },
  brandCopy: { minWidth: 0, flex: 1, gap: theme.spacing.xxs },
  navigationItems: { minWidth: 0, flexDirection: { compact: "row", expanded: "column" }, gap: theme.spacing.xs },
  navigationItem: { minWidth: 0, minHeight: 52, flex: { compact: 1, expanded: 0 }, borderRadius: theme.radii.md, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.sm, gap: theme.spacing.xs, alignItems: "center", justifyContent: "center", flexDirection: { compact: "column", expanded: "row" } },
  navigationItemSelected: { backgroundColor: theme.colors.interactive.subtle },
  navigationItemPressed: { opacity: theme.interactionFeedback.pressedOpacity },
  navigationFooter: { display: { compact: "none", expanded: "flex" }, marginTop: "auto", gap: theme.spacing.xs },
  topBar: { minWidth: 0, minHeight: 76, paddingHorizontal: { compact: theme.spacing.lg, expanded: theme.spacing.xxl }, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.lg, backgroundColor: theme.colors.background.canvas, borderBottomWidth: theme.strokeWidths.standard, borderBottomColor: theme.colors.border.subtle },
  topBarCopy: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  topBarActions: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  utilityButton: { width: 44, height: 44, borderRadius: theme.radii.sm, alignItems: "center", justifyContent: "center", borderWidth: theme.strokeWidths.standard, borderColor: theme.colors.border.default, backgroundColor: theme.colors.background.surface },
  utilityButtonSelected: { borderColor: theme.colors.interactive.primary, backgroundColor: theme.colors.interactive.subtle },
  scroll: { flex: 1, minWidth: 0 },
  scrollContent: { minWidth: 0, flexGrow: 1, paddingHorizontal: { compact: theme.spacing.lg, medium: theme.spacing.xl, expanded: theme.spacing.xxl, wide: theme.spacing.xxxl }, paddingTop: { compact: theme.spacing.xl, expanded: theme.spacing.xxl }, paddingBottom: theme.spacing.huge, gap: theme.spacing.lg },
}));
