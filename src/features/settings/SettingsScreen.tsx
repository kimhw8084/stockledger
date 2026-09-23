import React, { useState, type ReactNode } from "react";
import {
  AlertBanner,
  Badge,
  Button,
  Card,
  Disclosure,
  HStack,
  PageHeader,
  SegmentedControl,
  StatusIndicator,
  StyleSheet,
  Text,
  VStack,
  View,
} from "../../ui";
import type { AppLanguage } from "../../lib/preferences";

export interface SettingsProviderView {
  provider: string;
  status: string;
  tone: "positive" | "warning" | "negative" | "neutral";
  mode: string;
  configured: boolean;
  note: string;
  endpoint?: string;
  checkedAt?: string;
}

export interface SettingsScreenProps {
  language: AppLanguage;
  providers: readonly SettingsProviderView[];
  healthyCount: number;
  limitedCount: number;
  unconfiguredCount: number;
  unavailableCount: number;
  trackedStocks: number;
  sampleData: boolean;
  lastSnapshotUpdate: string;
  notificationSummary: string;
  notificationTone: "positive" | "warning" | "neutral";
  syncSummary: string;
  providerCheckPending: boolean;
  scanPending: boolean;
  cloudConfigured: boolean;
  workspacePanel: ReactNode;
  notificationPanel: ReactNode;
  syncPanel: ReactNode;
  onLanguageChange: (language: AppLanguage) => void;
  onCheckProviders: () => void;
  onRefreshSnapshots: () => Promise<void>;
  onRunScan: () => Promise<void>;
}

const words = (language: AppLanguage) => language === "ko" ? {
  description: "워크스페이스와 데이터 제공 상태를 확인하고, 지원되는 설정이나 점검을 선택합니다.",
  overview: "운영 상태",
  local: "이 기기의 워크스페이스",
  localBody: "기록은 이 기기에 저장됩니다. 백업은 직접 내보내고 복원하기 전에 검증합니다.",
  sample: "샘플 데이터 사용 중",
  personal: "개인 기록 데이터",
  providers: "데이터 제공자",
  healthy: "정상",
  limited: "제한",
  unconfigured: "미설정",
  unavailable: "사용 불가",
  stocks: "추적 종목",
  check: "제공자 설정 확인",
  checking: "제공자 설정 확인 중",
  refresh: "스냅샷 새로고침",
  refreshing: "저장된 스냅샷 확인 중",
  scan: "일일 스캔 실행",
  scanning: "스캔 실행 중",
  lastSnapshot: "저장된 데이터 확인 시각",
  noSnapshot: "스냅샷 갱신 시각 없음",
  noProviders: "확인된 제공자 상태가 없습니다.",
  providerNote: "현재 제공자 설정과 보고된 가용성입니다. 실시간 서비스 상태 점검은 아닙니다. 미설정, 제한, 오류는 사용 가능한 원천이 아님을 뜻합니다.",
  workspace: "워크스페이스와 데이터",
  notifications: "알림 설정과 전달 상태",
  sync: "동기화 및 계정 상태",
  language: "언어",
  languageNote: "표시 언어를 선택합니다.",
  english: "English",
  korean: "한국어",
  localOnly: "기기 간 동기화는 자동으로 실행되지 않습니다.",
  cloudReady: "선택적 개인 클라우드 기능이 설정되어 있습니다.",
  syncNotHosted: "호스팅된 상시 서비스 상태를 의미하지 않습니다.",
  noStocksToRefresh: "스냅샷을 새로고침하려면 먼저 추적 종목을 추가하세요.",
  refreshComplete: "새로고침 요청이 끝났습니다. 아래 출처와 갱신 시각으로 실제 결과를 확인하세요.",
  scanComplete: "스캔 요청이 끝났습니다. 결과와 데이터 한계는 Recipes에서 확인하세요.",
  operationFailed: "요청을 완료하지 못했습니다.",
} : {
  description: "Check workspace and provider state, then choose a supported setting or operation.",
  overview: "Operating state",
  local: "Workspace on this device",
  localBody: "Records are stored on this device. Backups are exported directly and validated before restore.",
  sample: "Sample data is active",
  personal: "Personal workspace data",
  providers: "Data providers",
  healthy: "Healthy",
  limited: "Limited",
  unconfigured: "Unconfigured",
  unavailable: "Unavailable",
  stocks: "Tracked stocks",
  check: "Check provider configuration",
  checking: "Checking provider configuration",
  refresh: "Refresh snapshots",
  refreshing: "Checking saved snapshots",
  scan: "Run daily scan",
  scanning: "Scanner is running",
  lastSnapshot: "Saved data checked at",
  noSnapshot: "No snapshot update time is recorded",
  noProviders: "No provider health report is available.",
  providerNote: "These statuses describe configuration and reported availability; they are not a live service health check. Missing, limited, and error states are not available data sources.",
  workspace: "Workspace and data",
  notifications: "Notification settings and delivery state",
  sync: "Sync and account state",
  language: "Language",
  languageNote: "Choose the display language.",
  english: "English",
  korean: "한국어",
  localOnly: "Cross-device sync does not run automatically.",
  cloudReady: "Optional personal cloud features are configured.",
  syncNotHosted: "This does not indicate a hosted always-on service.",
  noStocksToRefresh: "Add a tracked stock before refreshing snapshots.",
  refreshComplete: "The refresh request finished. Confirm its result from the source and update times below.",
  scanComplete: "The scan request finished. Review its results and data limits in Recipes.",
  operationFailed: "The request could not be completed.",
};

export function SettingsScreen(props: SettingsScreenProps) {
  const copy = words(props.language);
  const [refreshPending, setRefreshPending] = useState(false);
  const [refreshRequested, setRefreshRequested] = useState(false);
  const [scanRequestPending, setScanRequestPending] = useState(false);
  const [scanRequested, setScanRequested] = useState(false);
  const [operationError, setOperationError] = useState("");
  const runRefresh = async () => {
    if (refreshPending || props.trackedStocks === 0) return;
    setRefreshPending(true);
    setRefreshRequested(false);
    setScanRequested(false);
    setOperationError("");
    try {
      await props.onRefreshSnapshots();
      setRefreshRequested(true);
    } catch (cause) {
      setOperationError(cause instanceof Error ? cause.message : copy.operationFailed);
    } finally {
      setRefreshPending(false);
    }
  };
  const runScan = async () => {
    if (scanRequestPending || props.scanPending) return;
    setScanRequestPending(true);
    setScanRequested(false);
    setRefreshRequested(false);
    setOperationError("");
    try {
      await props.onRunScan();
      setScanRequested(true);
    } catch (cause) {
      setOperationError(cause instanceof Error ? cause.message : copy.operationFailed);
    } finally {
      setScanRequestPending(false);
    }
  };
  return (
    <View style={styles.root} nativeID="settings-primary-surface">
      <PageHeader title={props.language === "ko" ? "설정" : "Settings"} description={copy.description} />

      <Card variant="elevated">
        <VStack gap="lg">
          <Text variant="h2">{copy.overview}</Text>
          <View style={styles.stateGrid}>
            <View style={styles.stateBlock}>
              <Text variant="label">{copy.local}</Text>
              <StatusIndicator label={props.sampleData ? copy.sample : copy.personal} description={copy.localBody} tone={props.sampleData ? "warning" : "info"} />
            </View>
            <View style={styles.stateBlock}>
              <Text variant="label">{copy.providers}</Text>
              <Text>{copy.healthy} {props.healthyCount} · {copy.limited} {props.limitedCount} · {copy.unconfigured} {props.unconfiguredCount} · {copy.unavailable} {props.unavailableCount}</Text>
              <Text variant="caption" tone="secondary">{copy.providerNote}</Text>
            </View>
            <View style={styles.stateBlock}>
              <Text variant="label">{copy.stocks}</Text>
              <Text variant="h3" numeric>{props.trackedStocks}</Text>
            </View>
            <View style={styles.stateBlock}>
              <Text variant="label">{copy.notifications}</Text>
              <StatusIndicator label={props.notificationSummary} description={copy.localBody} tone={props.notificationTone} />
            </View>
            <View style={styles.stateBlock}>
              <Text variant="label">{copy.sync}</Text>
              <Text>{props.syncSummary}</Text>
              <Text variant="caption" tone="secondary">{copy.syncNotHosted}</Text>
            </View>
            <View style={styles.stateBlock}>
              <Text variant="label">{copy.lastSnapshot}</Text>
              <Text tone="secondary">{props.lastSnapshotUpdate || copy.noSnapshot}</Text>
            </View>
          </View>

          <View style={styles.operations}>
            <Button
              label={props.providerCheckPending ? copy.checking : copy.check}
              onPress={props.onCheckProviders}
              loading={props.providerCheckPending}
              disabled={props.providerCheckPending}
              responsiveWidth="compact-full"
            />
            <Button
              label={refreshPending ? copy.refreshing : copy.refresh}
              onPress={() => { void runRefresh(); }}
              loading={refreshPending}
              disabled={refreshPending || props.trackedStocks === 0}
              variant="secondary"
              responsiveWidth="compact-full"
            />
            <Button
              label={props.scanPending || scanRequestPending ? copy.scanning : copy.scan}
              onPress={() => { void runScan(); }}
              loading={props.scanPending || scanRequestPending}
              disabled={props.scanPending || scanRequestPending}
              variant="secondary"
              responsiveWidth="compact-full"
            />
          </View>
          {props.trackedStocks === 0 ? <Text variant="caption" tone="secondary">{copy.noStocksToRefresh}</Text> : null}
          {operationError ? <AlertBanner tone="warning" title={copy.operationFailed} message={operationError} /> : null}
          {refreshRequested && !operationError ? (
            <View accessibilityLiveRegion="polite"><Text variant="caption" tone="secondary">{copy.refreshComplete}</Text></View>
          ) : null}
          {scanRequested ? <View accessibilityLiveRegion="polite"><Text variant="caption" tone="secondary">{copy.scanComplete}</Text></View> : null}
          {props.providerCheckPending || props.scanPending || refreshPending || scanRequestPending ? (
            <View accessibilityLiveRegion="polite">
              <Text variant="caption" tone="info">{props.providerCheckPending ? copy.checking : refreshPending ? copy.refreshing : copy.scanning}</Text>
            </View>
          ) : null}
        </VStack>
      </Card>

      <View style={styles.providerList}>
        {props.providers.length === 0 ? <Card variant="subtle"><Text tone="secondary">{copy.noProviders}</Text></Card> : props.providers.map((provider, index) => (
          <React.Fragment key={provider.provider}>
            {index > 0 ? <View style={styles.providerDivider} /> : null}
            <View style={styles.providerRow}>
              <View style={styles.providerCopy}>
                <HStack gap="sm" align="center">
                  <Text variant="h3">{provider.provider}</Text>
                  <Badge label={provider.status} tone={provider.tone} />
                  <Badge label={provider.configured ? (props.language === "ko" ? "설정됨" : "Configured") : (props.language === "ko" ? "미설정" : "Unconfigured")} tone={provider.configured ? "info" : "warning"} />
                </HStack>
                <Text>{provider.note}</Text>
                <Text variant="caption" tone="secondary">{provider.mode}{provider.endpoint ? ` · ${provider.endpoint}` : ""}{provider.checkedAt ? ` · ${provider.checkedAt}` : ""}</Text>
              </View>
            </View>
          </React.Fragment>
        ))}
      </View>

      <View style={styles.languageSection}>
        <PageHeader title={copy.language} description={copy.languageNote} />
        <SegmentedControl
          label={copy.language}
          value={props.language}
          options={[{ value: "en", label: copy.english }, { value: "ko", label: copy.korean }]}
          onChange={(value) => props.onLanguageChange(value as AppLanguage)}
          testID="settings-language-control"
        />
      </View>

      <View style={styles.disclosures}>
        <Disclosure id="settings-workspace" title={copy.workspace} description={copy.localBody}>
          {props.workspacePanel}
        </Disclosure>
        <Disclosure id="settings-notifications" title={copy.notifications}>
          {props.notificationPanel}
        </Disclosure>
        <Disclosure
          id="settings-sync"
          title={copy.sync}
          description={`${props.cloudConfigured ? copy.cloudReady : copy.localOnly} ${copy.syncNotHosted}`}
        >
          <VStack gap="md">
            <Text variant="caption" tone="secondary">{props.cloudConfigured ? copy.cloudReady : copy.localOnly} {copy.syncNotHosted}</Text>
            {props.syncPanel}
          </VStack>
        </Disclosure>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { minWidth: 0, gap: theme.spacing.xl },
  stateGrid: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, flexWrap: "wrap", gap: theme.spacing.lg },
  stateBlock: { minWidth: 0, flex: 1, flexBasis: { compact: "100%", medium: "42%" }, gap: theme.spacing.xs },
  operations: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, flexWrap: "wrap", gap: theme.spacing.sm, paddingTop: theme.spacing.sm, borderTopWidth: theme.strokeWidths.standard, borderTopColor: theme.colors.border.subtle },
  providerList: { minWidth: 0, gap: theme.spacing.sm },
  providerRow: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: "flex-start", gap: theme.spacing.md, paddingVertical: theme.spacing.md },
  providerCopy: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  providerDivider: { height: theme.strokeWidths.standard, backgroundColor: theme.colors.border.subtle },
  languageSection: { minWidth: 0, gap: theme.spacing.md },
  disclosures: { minWidth: 0, gap: theme.spacing.md },
}));
