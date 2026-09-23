import React from "react";
import {
  Badge,
  Button,
  Card,
  Divider,
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

export type RecipeLayer = "Raw Data" | "Formulas" | "Rules" | "Sets";

export interface RecipeLayerChoice {
  value: RecipeLayer;
  label: string;
}

export interface RecipeRawSourceRow {
  id: string;
  title: string;
  description: string;
  source: string;
  freshness: string;
  fields: string[];
}

export interface RecipeFormulaRow {
  id: string;
  name: string;
  meaning: string;
  requiredData: string[];
  availability: string;
  freshness: string;
  editable: boolean;
}

export interface RecipeRuleRow {
  id: string;
  recipeId: string;
  label: string;
  recipeName: string;
  version: number;
  role: string;
  availability: string;
}

export interface RecipeSetRow {
  id: string;
  name: string;
  version: number;
  purpose: string;
  intendedUse: string;
  timeHorizon: string;
  cadence: string;
  ruleCount: number;
  scannerState: string;
}

export interface RecipeSignalRow {
  id: string;
  ticker: string;
  status: string;
  rule: string;
  description: string;
  evidenceSummary: string;
  sector: string;
  reviewLogged: boolean;
}

export interface RecipesScreenProps {
  language: AppLanguage;
  layer: RecipeLayer;
  layerChoices: readonly RecipeLayerChoice[];
  onLayerChange: (layer: RecipeLayer) => void;
  rawSources: readonly RecipeRawSourceRow[];
  formulas: readonly RecipeFormulaRow[];
  rules: readonly RecipeRuleRow[];
  sets: readonly RecipeSetRow[];
  signals: readonly RecipeSignalRow[];
  scanner: {
    lastRun: string;
    matched: number;
    near: number;
    blocked: number;
    ruleCount: number;
    running: boolean;
  };
  onRunScanner: () => void;
  onOpenRawRegistry: () => void;
  onOpenFormula: (id: string) => void;
  onCreateFormula: () => void;
  onOpenRule: (recipeId: string, ruleId: string) => void;
  onOpenSet: (id: string) => void;
  onOpenSetVersions: (id: string) => void;
  onCreateSet: () => void;
  onOpenSignalReview: (signalId: string) => void;
}

const labels = (language: AppLanguage) => language === "ko" ? {
  layer: "논리 계층",
  raw: "L0 원천 데이터",
  formulas: "L1 수식",
  rules: "L1.5 규칙",
  sets: "L2 세트",
  rawMeaning: "외부에서 관측하거나 직접 가져온 입력값입니다. 해석과 계산 전의 상태를 확인합니다.",
  formulaMeaning: "원천 입력을 재현 가능한 값이나 조건으로 계산합니다. 각 수식은 필요한 데이터와 갱신 기대를 공개합니다.",
  ruleMeaning: "계산된 값을 역할과 비교 조건에 연결합니다. 알 수 없는 입력은 통과로 간주하지 않습니다.",
  setMeaning: "여러 규칙을 목적, 사용 범위, 검토 주기에 맞춰 함께 사용합니다.",
  scanner: "스캐너 상태",
  noScan: "저장된 스캔 실행이 없습니다.",
  runScan: "지원되는 일일 스캔 실행",
  matched: "일치",
  near: "근접",
  blocked: "데이터로 차단",
  rulesCount: "평가 규칙",
  sources: "입력 출처",
  formulasTitle: "등록된 수식",
  rulesTitle: "등록된 규칙",
  setsTitle: "모니터링 세트",
  signals: "스캔 결과",
  registry: "원천 데이터 레지스트리 열기",
  createFormula: "수식 작성",
  editFormula: "수식 상세 및 수정",
  editRule: "규칙 상세 및 수정",
  createSet: "새 세트 작성",
  openSet: "세트 상세 보기",
  versions: "버전 이력",
  reviewSignal: "검토 기록 열기",
  version: "버전",
  intendedUse: "사용 목적",
  cadence: "검토 주기",
  ruleCount: "규칙 수",
  data: "필요 데이터",
  source: "출처",
  freshness: "갱신 기대",
  empty: "이 계층에 표시할 항목이 없습니다.",
  noSets: "사용 가능한 세트가 없습니다. 데이터 지원 범위를 확인하거나 기존 세트를 직접 작성하세요.",
  noSignals: "최근 스캔에서 표시할 신호가 없습니다. 이는 조건을 만족한 결과가 없거나 필수 입력이 부족한 경우일 수 있습니다.",
  logged: "검토 기록 있음",
  notLogged: "검토 기록 없음",
  noData: "필수 입력의 가용성 또는 최신성이 제한될 수 있습니다.",
} : {
  layer: "Logic layer",
  raw: "L0 Raw data",
  formulas: "L1 Formulas",
  rules: "L1.5 Rules",
  sets: "L2 Sets",
  rawMeaning: "Observed or imported inputs before interpretation. Review their source and freshness here.",
  formulaMeaning: "Calculate reproducible values or conditions from source inputs, with required data and refresh expectations visible.",
  ruleMeaning: "Connect calculated values to roles and comparison conditions. Unknown inputs never count as a pass.",
  setMeaning: "Use related rules together with an explicit purpose, scope, and review cadence.",
  scanner: "Scanner state",
  noScan: "No saved scanner run is available.",
  runScan: "Run supported daily scan",
  matched: "Matched",
  near: "Near match",
  blocked: "Blocked by data",
  rulesCount: "Rules evaluated",
  sources: "Source inputs",
  formulasTitle: "Available formulas",
  rulesTitle: "Available rules",
  setsTitle: "Monitoring sets",
  signals: "Scan results",
  registry: "Open raw data registry",
  createFormula: "Create formula",
  editFormula: "Formula detail and edit",
  editRule: "Rule detail and edit",
  createSet: "Create set",
  openSet: "Open set detail",
  versions: "Version history",
  reviewSignal: "Open review record",
  version: "Version",
  intendedUse: "Intended use",
  cadence: "Review cadence",
  ruleCount: "Rules",
  data: "Required data",
  source: "Source",
  freshness: "Refresh expectation",
  empty: "No items are available in this layer.",
  noSets: "No compatible sets are available. Check data support or deliberately create a set from the existing rules.",
  noSignals: "There are no signals to show from the latest scan. No conditions may have matched, or required inputs may be missing.",
  logged: "Review recorded",
  notLogged: "No review recorded",
  noData: "Required inputs may have limited availability or freshness.",
};

const layerMeaning = (language: AppLanguage, layer: RecipeLayer) => {
  const text = labels(language);
  switch (layer) {
    case "Raw Data": return text.rawMeaning;
    case "Formulas": return text.formulaMeaning;
    case "Rules": return text.ruleMeaning;
    case "Sets": return text.setMeaning;
  }
};

export function RecipesScreen(props: RecipesScreenProps) {
  const text = labels(props.language);
  const layerTitle = props.layerChoices.find((choice) => choice.value === props.layer)?.label ?? text.layer;
  return (
    <View style={styles.root} nativeID="recipes-primary-surface">
      <Card variant="elevated">
        <VStack gap="md">
          <Text variant="label">{text.layer}</Text>
          <SegmentedControl
            label={text.layer}
            value={props.layer}
            options={props.layerChoices}
            onChange={(value) => props.onLayerChange(value as RecipeLayer)}
            testID="recipe-layer-control"
          />
          <Text variant="h3">{layerTitle}</Text>
          <Text tone="secondary">{layerMeaning(props.language, props.layer)}</Text>
        </VStack>
      </Card>

      {props.layer === "Raw Data" ? (
        <VStack gap="md">
          <PageHeader title={text.sources} description={text.rawMeaning} />
          {props.rawSources.length ? props.rawSources.map((source) => (
            <View key={source.id} style={styles.listRow}>
              <View style={styles.flexOne}>
                <Text variant="h3">{source.title}</Text>
                <Text>{source.description}</Text>
                <Text variant="caption" tone="secondary">{text.source}: {source.source} · {text.freshness}: {source.freshness}</Text>
                <Text variant="caption" tone="secondary">{source.fields.join(" · ")}</Text>
              </View>
            </View>
          )) : <Card variant="subtle"><Text tone="secondary">{text.empty}</Text></Card>}
          <Button label={text.registry} variant="secondary" onPress={props.onOpenRawRegistry} responsiveWidth="compact-full" />
        </VStack>
      ) : null}

      {props.layer === "Formulas" ? (
        <VStack gap="md">
          <PageHeader title={text.formulasTitle} description={text.formulaMeaning} actions={<Button label={text.createFormula} onPress={props.onCreateFormula} responsiveWidth="compact-full" />} />
          {props.formulas.length ? props.formulas.map((formula, index) => (
            <React.Fragment key={formula.id}>
              {index > 0 ? <Divider inset="start" /> : null}
              <View style={styles.listRow}>
                <View style={styles.flexOne}>
                  <Text variant="h3">{formula.name}</Text>
                  <Text>{formula.meaning}</Text>
                  <StatusIndicator label={formula.availability} description={`${text.data}: ${formula.requiredData.join(" · ")} · ${text.freshness}: ${formula.freshness}`} tone={formula.editable ? "info" : "neutral"} />
                </View>
                {formula.editable ? <Button label={text.editFormula} variant="secondary" size="sm" onPress={() => props.onOpenFormula(formula.id)} responsiveWidth="compact-full" /> : null}
              </View>
            </React.Fragment>
          )) : <Card variant="subtle"><Text tone="secondary">{text.empty}</Text></Card>}
        </VStack>
      ) : null}

      {props.layer === "Rules" ? (
        <VStack gap="md">
          <PageHeader title={text.rulesTitle} description={text.ruleMeaning} />
          {props.rules.length ? props.rules.map((rule, index) => (
            <React.Fragment key={`${rule.recipeId}:${rule.id}`}>
              {index > 0 ? <Divider inset="start" /> : null}
              <View style={styles.listRow}>
                <View style={styles.flexOne}>
                  <Text variant="h3">{rule.label}</Text>
                  <Text>{rule.role}</Text>
                  <Text variant="caption" tone="secondary">{rule.recipeName} · v{rule.version} · {rule.availability}</Text>
                </View>
                <Button label={text.editRule} variant="secondary" size="sm" onPress={() => props.onOpenRule(rule.recipeId, rule.id)} responsiveWidth="compact-full" />
              </View>
            </React.Fragment>
          )) : <Card variant="subtle"><Text tone="secondary">{text.empty}</Text></Card>}
        </VStack>
      ) : null}

      {props.layer === "Sets" ? (
        <VStack gap="md">
          <PageHeader title={text.setsTitle} actions={<Button label={text.createSet} onPress={props.onCreateSet} responsiveWidth="compact-full" />} />
          {props.sets.length ? props.sets.map((set, index) => (
            <React.Fragment key={set.id}>
              {index > 0 ? <Divider inset="start" /> : null}
              <View style={styles.setRow}>
                <View style={styles.flexOne}>
                  <HStack gap="sm" align="center">
                    <Text variant="h3">{set.name}</Text>
                    <Badge label={`v${set.version}`} tone="neutral" />
                  </HStack>
                  <Text>{set.purpose}</Text>
                  <Text variant="caption" tone="secondary">{text.intendedUse}: {set.intendedUse} · {set.timeHorizon}</Text>
                  <Text variant="caption" tone="secondary">{text.cadence}: {set.cadence} · {text.ruleCount}: {set.ruleCount}</Text>
                  <Text variant="caption" tone="secondary">{text.scanner}: {set.scannerState}{set.ruleCount === 0 ? ` · ${text.noData}` : ""}</Text>
                </View>
                <View style={styles.setActions}>
                  <Button label={text.openSet} variant="secondary" size="sm" onPress={() => props.onOpenSet(set.id)} responsiveWidth="compact-full" />
                  <Button label={text.versions} variant="ghost" size="sm" onPress={() => props.onOpenSetVersions(set.id)} responsiveWidth="compact-full" />
                </View>
              </View>
            </React.Fragment>
          )) : <Card variant="subtle"><Text tone="secondary">{text.noSets}</Text></Card>}
        </VStack>
      ) : null}

      <Card variant="subtle" padding="compact">
        <VStack gap="md">
          <View style={styles.scanHeader}>
            <View style={styles.flexOne}>
              <Text variant="h3">{text.scanner}</Text>
              <Text tone="secondary">{props.scanner.lastRun || text.noScan}</Text>
            </View>
            <Button label={text.runScan} onPress={props.onRunScanner} loading={props.scanner.running} disabled={props.scanner.running} responsiveWidth="compact-full" />
          </View>
          <View style={styles.scanStats}>
            <View style={styles.stat}><Text variant="micro" tone="secondary">{text.matched}</Text><Text variant="h3" numeric>{props.scanner.matched}</Text></View>
            <View style={styles.stat}><Text variant="micro" tone="secondary">{text.near}</Text><Text variant="h3" numeric>{props.scanner.near}</Text></View>
            <View style={styles.stat}><Text variant="micro" tone="secondary">{text.blocked}</Text><Text variant="h3" numeric>{props.scanner.blocked}</Text></View>
            <View style={styles.stat}><Text variant="micro" tone="secondary">{text.rulesCount}</Text><Text variant="h3" numeric>{props.scanner.ruleCount}</Text></View>
          </View>
          {props.signals.length > 0 ? (
            <View>
              <Text variant="label">{text.signals}</Text>
              {props.signals.slice(0, 5).map((signal, index) => (
                <React.Fragment key={signal.id}>
                  {index > 0 ? <Divider inset="start" /> : null}
                  <View style={styles.signalRow}>
                    <View style={styles.flexOne}>
                      <HStack gap="sm" align="center">
                        <Text variant="label" numeric direction="ltr">{signal.ticker}</Text>
                        <Badge label={signal.status} tone={signal.status.toLowerCase().includes("blocked") || signal.status.toLowerCase().includes("불완전") ? "warning" : "info"} />
                        {signal.reviewLogged ? <Badge label={text.logged} tone="positive" /> : null}
                      </HStack>
                      <Text variant="caption" tone="secondary">{signal.rule} · {signal.sector}</Text>
                      <Text>{signal.evidenceSummary}</Text>
                    </View>
                    <Button label={text.reviewSignal} variant="secondary" size="sm" onPress={() => props.onOpenSignalReview(signal.id)} responsiveWidth="compact-full" />
                  </View>
                </React.Fragment>
              ))}
            </View>
          ) : null}
        </VStack>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { minWidth: 0, gap: theme.spacing.xl },
  scanHeader: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "center" }, justifyContent: "space-between", gap: theme.spacing.md },
  scanStats: { minWidth: 0, flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.lg, paddingVertical: theme.spacing.sm, borderTopWidth: theme.strokeWidths.standard, borderBottomWidth: theme.strokeWidths.standard, borderColor: theme.colors.border.subtle },
  stat: { minWidth: 72, gap: theme.spacing.xxs },
  flexOne: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  signalRow: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "center" }, justifyContent: "space-between", gap: theme.spacing.md, paddingVertical: theme.spacing.md },
  listRow: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "center" }, justifyContent: "space-between", gap: theme.spacing.md, paddingVertical: theme.spacing.sm },
  setRow: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "flex-start" }, justifyContent: "space-between", gap: theme.spacing.md, paddingVertical: theme.spacing.sm },
  setActions: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, flexWrap: "wrap", gap: theme.spacing.xs },
}));
