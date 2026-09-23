import React, { useState } from "react";
import { Badge, Button, Card, Disclosure, StyleSheet, Text, TextInput, View, VStack, Pressable } from "../../../ui";
import { t } from "../../../lib/i18n";
import type { AppLanguage } from "../../../lib/preferences";

export type ScannerReviewDecision = "watch" | "ignore" | "bought" | "skipped" | "sold" | "other";

export interface ScannerReviewSignalViewModel {
  ticker: string;
  ruleId: string;
  status: string;
  blocked: boolean;
  reason: string;
  signalDate: string;
  scanDate: string;
  sourceContext: string;
  providerName: string;
  runStatus: string;
  matchedConditions: string[];
  missingConditions: string[];
  failedConditions: string[];
}

export interface ScannerReviewForm {
  userDecision: ScannerReviewDecision | "";
  manualReason: string;
  convictionScoreOptional: string;
  notes: string;
  entryPriceOptional: string;
  exitPriceOptional: string;
  resultNotes: string;
}

interface ScannerReviewProps {
  language: AppLanguage;
  signal: ScannerReviewSignalViewModel;
  form: ScannerReviewForm;
  onFormChange: (next: ScannerReviewForm) => void;
  onSave: () => void;
}

const decisions: ScannerReviewDecision[] = ["watch", "ignore", "bought", "skipped", "sold", "other"];
const labelForDecision = (language: AppLanguage, decision: ScannerReviewDecision) => {
  const en: Record<ScannerReviewDecision, string> = { watch: "Watch", ignore: "Ignore", bought: "Bought", skipped: "Skipped", sold: "Sold", other: "Other" };
  const ko: Record<ScannerReviewDecision, string> = { watch: "관찰", ignore: "제외", bought: "매수했음", skipped: "건너뜀", sold: "매도했음", other: "기타" };
  return (language === "ko" ? ko : en)[decision];
};

export function ScannerReview({ language, signal, form, onFormChange, onSave }: ScannerReviewProps) {
  const ko = language === "ko";
  const [focusedDecision, setFocusedDecision] = useState<ScannerReviewDecision | null>(null);
  const update = <K extends keyof ScannerReviewForm>(key: K, value: ScannerReviewForm[K]) => onFormChange({ ...form, [key]: value });
  const statusTone = signal.blocked ? "warning" : "info";
  return (
    <View style={styles.root}>
    <VStack gap="md">
      <Card variant={signal.blocked ? "elevated" : "surface"} padding="compact">
        <VStack gap="sm">
          <View style={styles.signalHeader}>
            <View style={styles.signalTitle}>
              <Text variant="micro" tone="secondary">{ko ? "스캐너 신호 검토" : "Scanner signal review"}</Text>
              <Text variant="h3">{signal.ticker} · {signal.ruleId}</Text>
            </View>
            <Badge label={signal.status} tone={statusTone} />
          </View>
          <Text variant="label">{ko ? "신호 상태와 제한" : "Signal state and limitation"}</Text>
          <Text selectable>{signal.reason}</Text>
          <View style={styles.signalFacts}>
            <Text variant="caption" tone="secondary">{ko ? "신호 날짜" : "Signal date"}: {signal.signalDate}</Text>
            <Text variant="caption" tone="secondary">{ko ? "스캔 날짜" : "Scan date"}: {signal.scanDate}</Text>
            <Text variant="caption" tone="secondary">{ko ? "종목 범위" : "Universe context"}: {signal.sourceContext}</Text>
            <Text variant="caption" tone="secondary">{ko ? "시장 데이터 제공자 · 실행 상태" : "Market data provider · run status"}: {signal.providerName} · {signal.runStatus}</Text>
          </View>
          {signal.missingConditions.length > 0 ? <ConditionList label={ko ? "확인할 수 없는 조건" : "Conditions that could not be checked"} values={signal.missingConditions} tone="warning" /> : null}
          {signal.failedConditions.length > 0 ? <ConditionList label={ko ? "충족하지 않은 조건" : "Conditions not met"} values={signal.failedConditions} /> : null}
          {signal.matchedConditions.length > 0 ? <ConditionList label={ko ? "확인된 조건" : "Conditions matched"} values={signal.matchedConditions} /> : null}
        </VStack>
      </Card>

      <Card variant="surface" padding="compact">
        <VStack gap="md">
          <View style={styles.reviewHeading}>
            <View style={styles.signalTitle}>
              <Text variant="h3">{ko ? "사람의 검토 분류" : "Human review classification"}</Text>
              <Text tone="secondary">{ko ? "이 기록은 사용자의 검토 의견입니다. 주문, 체결 또는 수익을 만들지 않습니다." : "This records your review classification. It does not place an order, record a fill, or imply a return."}</Text>
            </View>
            <Badge label={ko ? "사람이 기록" : "Human recorded"} tone="info" />
          </View>
          <View style={styles.choiceGroup} accessibilityRole="radiogroup" accessibilityLabel={ko ? "검토 분류" : "Review classification"}>
            <Text variant="micro" tone="secondary">{ko ? "사람의 검토 분류를 선택하세요." : "Choose a human review classification."}</Text>
            {decisions.map((decision) => (
              <Pressable
                key={decision}
                accessibilityRole="radio"
                accessibilityLabel={labelForDecision(language, decision)}
                accessibilityState={{ selected: form.userDecision === decision }}
                onPress={() => update("userDecision", decision)}
                onFocus={() => setFocusedDecision(decision)}
                onBlur={() => setFocusedDecision((current) => current === decision ? null : current)}
                style={[styles.choice, form.userDecision === decision ? styles.choiceSelected : null, focusedDecision === decision ? styles.choiceFocused : null]}
              >
                <Text variant="label">{labelForDecision(language, decision)}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.field}>
            <Text variant="label">{ko ? "수동 사유 · 필수" : "Manual reason · required"}</Text>
            <TextInput
              accessibilityLabel={ko ? "수동 사유, 필수" : "Manual reason, required"}
              accessibilityHint={ko ? "검토 분류를 기록하는 이유를 입력하세요." : "Explain why you are recording this classification."}
              aria-required
              multiline
              value={form.manualReason}
              onChangeText={(value) => update("manualReason", value)}
              placeholder={t(language, "logic.scanner.manualReasonPlaceholder")}
              style={[styles.input, styles.reasonInput]}
            />
          </View>

          <Disclosure
            id="scanner-review-optional-fields"
            title={ko ? "선택 기록 필드" : "Optional review fields"}
            description={ko ? "확신도, 가격 및 결과 메모는 선택 사항입니다." : "Conviction, price, and result notes are optional."}
          >
            <View style={styles.optionalFields}>
            <VStack gap="sm">
              <Field label={t(language, "logic.scanner.notes")} value={form.notes} onChange={(value) => update("notes", value)} multiline />
              <View style={styles.optionalRow}>
                <Field label={t(language, "logic.scanner.conviction")} value={form.convictionScoreOptional} onChange={(value) => update("convictionScoreOptional", value)} placeholder="0–100" keyboardType="numeric" />
                <Field label={t(language, "logic.scanner.entryPrice")} value={form.entryPriceOptional} onChange={(value) => update("entryPriceOptional", value)} placeholder="0.00" keyboardType="numeric" />
              </View>
              <View style={styles.optionalRow}>
                <Field label={t(language, "logic.scanner.exitPrice")} value={form.exitPriceOptional} onChange={(value) => update("exitPriceOptional", value)} placeholder="0.00" keyboardType="numeric" />
                <Field label={t(language, "logic.scanner.resultNotes")} value={form.resultNotes} onChange={(value) => update("resultNotes", value)} placeholder={t(language, "logic.scanner.resultNotesPlaceholder")} />
              </View>
            </VStack>
            </View>
          </Disclosure>

          <Button
            label={t(language, "logic.scanner.saveLog")}
            onPress={onSave}
            disabled={!form.userDecision || !form.manualReason.trim()}
            responsiveWidth="compact-full"
          />
          <Text variant="caption" tone="secondary">{ko ? "저장하면 검토 로그만 추가됩니다. 시장 상태, 주문, 체결 또는 결과를 확인한 것으로 표시하지 않습니다." : "Saving adds a review log only. It does not confirm market conditions, orders, fills, or outcomes."}</Text>
        </VStack>
      </Card>
    </VStack>
    </View>
  );
}

function ConditionList({ label, values, tone = "neutral" }: { label: string; values: string[]; tone?: "warning" | "neutral" }) {
  return (
    <View style={styles.conditionGroup}>
      <Text variant="micro" tone={tone === "warning" ? "warning" : "secondary"}>{label}</Text>
      <Text selectable>{values.join(" · ")}</Text>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType, multiline = false }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; keyboardType?: "numeric"; multiline?: boolean }) {
  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline ? styles.reasonInput : null]}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { minWidth: 0 },
  signalHeader: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "flex-start" }, gap: theme.spacing.md },
  signalTitle: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  signalFacts: { gap: theme.spacing.xxs },
  conditionGroup: { minWidth: 0, gap: theme.spacing.xs, padding: theme.spacing.sm, borderRadius: theme.radii.sm, backgroundColor: theme.colors.background.subtle },
  reviewHeading: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, alignItems: { compact: "stretch", medium: "flex-start" }, gap: theme.spacing.md },
  choiceGroup: { minWidth: 0, flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
  choice: { minWidth: "30%", minHeight: 44, paddingHorizontal: theme.spacing.md, borderWidth: theme.strokeWidths.standard, borderColor: theme.colors.border.default, borderRadius: theme.radii.md, alignItems: "center", justifyContent: "center" },
  choiceSelected: { borderColor: theme.colors.interactive.primary, backgroundColor: theme.colors.interactive.subtle },
  choiceFocused: { borderColor: theme.colors.border.focus, borderWidth: 3 },
  field: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
  input: { minWidth: 0, width: "100%", minHeight: 44, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderWidth: theme.strokeWidths.standard, borderColor: theme.colors.border.default, borderRadius: theme.radii.md, backgroundColor: theme.colors.background.surface, color: theme.colors.text.primary, fontSize: theme.typography.body.fontSize, textAlignVertical: "top" },
  reasonInput: { minHeight: 112 },
  optionalFields: { paddingTop: theme.spacing.md },
  optionalRow: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, gap: theme.spacing.sm },
}));
