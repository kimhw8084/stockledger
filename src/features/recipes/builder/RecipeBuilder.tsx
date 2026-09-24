import React from "react";
import { Button, Card, StyleSheet, Text, View } from "../../../ui";
import { WindowPanel } from "../../../components/WindowPanel";
import {
  localizedOpportunityType,
  localizedRecipeBuilderPrompt,
  localizedRecipeBuilderStep,
  localizedRecipeOptionValue,
  localizedTimeHorizon,
  localizedUseCase,
  t,
  type AppLanguage,
} from "../../../lib/i18n";
import type { ConditionOperator, ConditionRole } from "../../../types";
import { AuthoringChoiceField, AuthoringTextField, SearchableOptionField } from "../../shared/AuthoringFields";

export type RecipeBuilderStep = "Purpose" | "Logic" | "Risk & Alerts" | "Review & Outcome";

export interface RecipeBuilderForm {
  name: string;
  purpose: string;
  opportunityType: string;
  timeHorizon: string;
  intendedUseCase: string;
  notes: string;
  reviewCadenceDays: number;
  alertCooldownHours: number;
}

export interface RecipeConditionDraft {
  metricKey: string;
  role: ConditionRole;
  operator: ConditionOperator;
  threshold: string;
  note: string;
}

export interface RecipeBuilderModel {
  step: RecipeBuilderStep;
  validationStep: RecipeBuilderStep | "";
  form: RecipeBuilderForm;
  conditionDraft: RecipeConditionDraft;
  opportunityTypes: readonly string[];
  timeHorizons: readonly string[];
  useCases: readonly string[];
  reviewCadences: readonly number[];
  cooldowns: readonly number[];
  metrics: readonly { key: string; name: string; meaning: string }[];
  conditionRoles: readonly { value: ConditionRole; label: string }[];
  operators: readonly string[];
  thresholdControl:
    | { type: "number"; step: number; min: number; max: number; unit?: string }
    | { type: "enum"; options: readonly string[] };
  selectedMetric?: { name: string; meaning: string };
  conditionPreview: string;
  conditions: readonly { id: string; kindLabel: string; label: string }[];
  riskRuleCount: number;
  readiness: readonly { step: RecipeBuilderStep; ready: boolean }[];
  previewStocks: readonly { id: string; symbol: string; name: string }[];
  previewStockId: string;
  preview?: { body: string; state: string; recipeVersion: string };
}

export function RecipeBuilder({
  language,
  editing,
  model,
  saving,
  onFormChange,
  onConditionChange,
  onAddCondition,
  onClearConditions,
  onRemoveCondition,
  onPreviewStock,
  onContinue,
  onBack,
  onSave,
  onCancel,
  returnFocusRef,
  fallbackFocusRef,
}: {
  language: AppLanguage;
  editing: boolean;
  model: RecipeBuilderModel;
  saving: boolean;
  onFormChange: (change: Partial<RecipeBuilderForm>) => void;
  onConditionChange: (change: Partial<RecipeConditionDraft>) => void;
  onAddCondition: () => void;
  onClearConditions: () => void;
  onRemoveCondition: (id: string) => void;
  onPreviewStock: (stockId: string) => void;
  onContinue: () => void;
  onBack: () => void;
  onSave: () => void;
  onCancel: () => void;
  returnFocusRef?: React.RefObject<any>;
  fallbackFocusRef?: React.RefObject<any>;
}) {
  const stepIndex = recipeSteps.indexOf(model.step);
  const currentReady = model.readiness[stepIndex]?.ready ?? false;
  const remaining = model.readiness.slice(stepIndex + 1).map(({ step }) => localizedRecipeBuilderStep(language, step)).join(" · ");
  const attempted = model.validationStep === model.step;
  const requiredLabel = t(language, "authoring.required");
  const thresholdControl = model.thresholdControl;
  const selectedOptionLabel = <T extends string>(values: readonly T[], value: string, localize: (item: T) => string) => {
    const selected = values.find((item) => item === value);
    return selected ? localize(selected) : value;
  };

  return (
    <WindowPanel
      title={t(language, editing ? "recipes.builder.editTitle" : "recipes.builder.title")}
      subtitle={t(language, editing ? "recipes.builder.editSubtitle" : "recipes.builder.subtitle")}
      onClose={onCancel}
      closeLabel={t(language, "common.done")}
      returnFocusRef={returnFocusRef}
      fallbackFocusRef={fallbackFocusRef}
    >
      <View style={styles.stack}>
        <Card variant="subtle">
          <View style={styles.stack}>
            <Text variant="label">{t(language, "recipes.builder.stepCount", { current: stepIndex + 1, total: recipeSteps.length })}</Text>
            <Text variant="h3">{localizedRecipeBuilderStep(language, model.step)}</Text>
            <Text variant="body" tone="secondary">{localizedRecipeBuilderPrompt(language, model.step)}</Text>
            <Text variant="label" tone={currentReady ? "positive" : "warning"}>
              {currentReady ? t(language, "recipes.builder.ready") : t(language, "recipes.builder.needsInput")}
              {` · ${t(language, "recipes.builder.requiredNow")}: ${requiredForStep(language, model.step)}`}
            </Text>
            {remaining ? <Text variant="caption" tone="secondary">{t(language, "recipes.builder.remaining", { steps: remaining })}</Text> : null}
          </View>
        </Card>

        {model.step === "Purpose" ? (
          <Card variant="subtle">
            <View style={styles.stack}>
              <Text variant="h3">{t(language, "recipes.builder.purposeSection")}</Text>
              <AuthoringTextField
                label={t(language, "recipes.builder.field.recipeName")}
                required
                requiredLabel={requiredLabel}
                value={model.form.name}
                onChangeText={(name) => onFormChange({ name })}
                placeholder={t(language, "recipes.builder.placeholder.recipeName")}
                error={attempted && !model.form.name.trim() ? t(language, "recipes.builder.validation.recipeNameRequired") : undefined}
                testID="recipe-name"
              />
              <AuthoringChoiceField
                label={t(language, "recipes.builder.field.opportunityType")}
                options={model.opportunityTypes.map((value) => ({ value, label: localizedOpportunityType(language, value) }))}
                value={model.form.opportunityType}
                onChange={(opportunityType) => onFormChange({ opportunityType })}
                testID="recipe-opportunity"
              />
              <AuthoringChoiceField
                label={t(language, "recipes.builder.field.timeHorizon")}
                options={model.timeHorizons.map((value) => ({ value, label: localizedTimeHorizon(language, value) }))}
                value={model.form.timeHorizon}
                onChange={(timeHorizon) => onFormChange({ timeHorizon })}
                testID="recipe-horizon"
              />
              <AuthoringChoiceField
                label={t(language, "recipes.builder.field.primaryUseCase")}
                options={model.useCases.map((value) => ({ value, label: localizedUseCase(language, value) }))}
                value={model.form.intendedUseCase}
                onChange={(intendedUseCase) => onFormChange({ intendedUseCase })}
                testID="recipe-use-case"
              />
              <AuthoringTextField
                label={t(language, "recipes.builder.field.purpose")}
                required
                requiredLabel={requiredLabel}
                value={model.form.purpose}
                onChangeText={(purpose) => onFormChange({ purpose })}
                placeholder={t(language, "recipes.builder.placeholder.purpose")}
                multiline
                error={attempted && !model.form.purpose.trim() ? t(language, "recipes.builder.validation.purposeRequired") : undefined}
                testID="recipe-purpose"
              />
            </View>
          </Card>
        ) : null}

        {model.step === "Logic" ? (
          <Card variant="subtle">
            <View style={styles.stack}>
              <Text variant="h3">{t(language, "recipes.builder.logicSection")}</Text>
              <SearchableOptionField
                label={language === "ko" ? "지표" : "Metric"}
                options={model.metrics.map((metric) => ({ value: metric.key, label: metric.name, detail: metric.meaning }))}
                value={model.conditionDraft.metricKey}
                onSelect={(metricKey) => onConditionChange({ metricKey })}
                placeholder={language === "ko" ? "지표 검색" : "Search metrics"}
                emptyLabel={t(language, "authoring.noMatches")}
                testID="recipe-metric"
              />
              {model.selectedMetric ? (
                <View style={styles.meaning}>
                  <Text variant="label">{t(language, "recipes.builder.metricMeaning")}</Text>
                  <Text variant="body">{model.selectedMetric.meaning}</Text>
                </View>
              ) : null}
              <AuthoringChoiceField
                label={t(language, "recipes.builder.field.conditionRole")}
                options={model.conditionRoles}
                value={model.conditionDraft.role}
                onChange={(role) => onConditionChange({ role: role as ConditionRole })}
                testID="recipe-condition-role"
              />
              <AuthoringChoiceField
                label={t(language, "recipes.builder.field.operator")}
                options={model.operators.map((value) => ({ value, label: value }))}
                value={model.conditionDraft.operator}
                onChange={(operator) => onConditionChange({ operator: operator as ConditionOperator })}
                testID="recipe-operator"
              />
              {thresholdControl.type === "number" ? (
                <View style={styles.field}>
                  <Text variant="label">{t(language, "recipes.builder.field.threshold")}</Text>
                  <View style={styles.stepper}>
                    <Button
                      label="−"
                      accessibilityLabel={t(language, "recipes.builder.thresholdDecrease")}
                      onPress={() => onConditionChange({ threshold: String(Math.max(thresholdControl.min, Number((Number(model.conditionDraft.threshold) - thresholdControl.step).toFixed(2)))) })}
                      variant="outline"
                    />
                    <Text accessibilityRole="text" aria-live="polite" variant="h3" numeric>
                      {model.conditionDraft.threshold}{thresholdControl.unit ? ` ${thresholdControl.unit}` : ""}
                    </Text>
                    <Button
                      label="+"
                      accessibilityLabel={t(language, "recipes.builder.thresholdIncrease")}
                      onPress={() => onConditionChange({ threshold: String(Math.min(thresholdControl.max, Number((Number(model.conditionDraft.threshold) + thresholdControl.step).toFixed(2)))) })}
                      variant="outline"
                    />
                  </View>
                  <Text variant="caption" tone="secondary">{t(language, "recipes.builder.thresholdBounds", { min: thresholdControl.min, max: thresholdControl.max, unit: thresholdControl.unit ?? "" })}</Text>
                </View>
              ) : (
                <AuthoringChoiceField
                  label={t(language, "recipes.builder.field.threshold")}
                  options={thresholdControl.options.map((value) => ({ value, label: localizedRecipeOptionValue(language, value) }))}
                  value={model.conditionDraft.threshold}
                  onChange={(threshold) => onConditionChange({ threshold })}
                  testID="recipe-threshold"
                />
              )}
              <AuthoringTextField
                label={t(language, "recipes.builder.field.whyMatters")}
                value={model.conditionDraft.note}
                onChangeText={(note) => onConditionChange({ note })}
                placeholder={t(language, "recipes.builder.placeholder.whyMatters")}
                multiline
                testID="recipe-condition-note"
              />
              <View style={styles.meaning}>
                <Text variant="label">{t(language, "recipes.builder.preview.condition")}</Text>
                <Text variant="body">{model.conditionPreview}</Text>
              </View>
              <View style={styles.actions}>
                <Button label={t(language, "recipes.builder.action.addCondition")} onPress={onAddCondition} responsiveWidth="compact-full" testID="recipe-add-condition" />
                {model.conditions.length ? <Button label={t(language, "recipes.builder.action.clearDraft")} onPress={onClearConditions} variant="secondary" responsiveWidth="compact-full" /> : null}
              </View>
              {attempted && model.conditions.length === 0 ? (
                <Text accessibilityRole="alert" role="alert" variant="caption" tone="negative">{t(language, "recipes.builder.validation.conditionRequired")}</Text>
              ) : null}
              {model.conditions.map((condition) => (
                <Card key={condition.id} variant="surface">
                  <View style={styles.conditionRow}>
                    <View style={styles.conditionCopy}>
                      <Text variant="label" tone="accent">{condition.kindLabel}</Text>
                      <Text selectable variant="body">{condition.label}</Text>
                    </View>
                    <Button label={t(language, "recipes.builder.action.remove")} onPress={() => onRemoveCondition(condition.id)} variant="ghost" />
                  </View>
                </Card>
              ))}
            </View>
          </Card>
        ) : null}

        {model.step === "Risk & Alerts" ? (
          <Card variant="subtle">
            <View style={styles.stack}>
              <Text variant="h3">{t(language, "recipes.builder.riskSection")}</Text>
              <Text variant="body" tone="secondary">{t(language, "recipes.builder.riskRulesNote", { count: model.riskRuleCount })}</Text>
              <AuthoringChoiceField
                label={t(language, "recipes.builder.field.alertCooldown")}
                options={model.cooldowns.map((hours) => ({ value: String(hours), label: t(language, "recipes.builder.cooldownValue", { hours }) }))}
                value={String(model.form.alertCooldownHours)}
                onChange={(value) => onFormChange({ alertCooldownHours: Number(value) })}
                testID="recipe-cooldown"
              />
              <AuthoringTextField
                label={t(language, "recipes.builder.field.notes")}
                hint={t(language, "recipes.builder.notesHint")}
                value={model.form.notes}
                onChangeText={(notes) => onFormChange({ notes })}
                placeholder={t(language, "recipes.builder.placeholder.notes")}
                multiline
                testID="recipe-notes"
              />
            </View>
          </Card>
        ) : null}

        {model.step === "Review & Outcome" ? (
          <View style={styles.stack}>
            <Card variant="subtle">
              <View style={styles.stack}>
                <Text variant="h3">{t(language, "recipes.builder.reviewSection")}</Text>
                <AuthoringChoiceField
                  label={t(language, "recipes.builder.field.reviewCadence")}
                  options={model.reviewCadences.map((days) => ({ value: String(days), label: t(language, "recipes.builder.cadenceValue", { days }) }))}
                  value={String(model.form.reviewCadenceDays)}
                  onChange={(value) => onFormChange({ reviewCadenceDays: Number(value) })}
                  testID="recipe-cadence"
                />
                <SearchableOptionField
                  label={t(language, "recipes.builder.field.previewStock")}
                  options={model.previewStocks.map((stock) => ({ value: stock.id, label: stock.symbol, detail: stock.name }))}
                  value={model.previewStockId}
                  onSelect={onPreviewStock}
                  placeholder={t(language, "recipes.builder.previewStockPlaceholder")}
                  emptyLabel={t(language, "authoring.noMatches")}
                  testID="recipe-preview-stock"
                />
              </View>
            </Card>
            {model.preview ? (
              <Card variant="subtle">
                <View style={styles.stack}>
                  <Text variant="label">{t(language, "recipes.builder.preview.result")}</Text>
                  <Text variant="h3">{model.preview.state}</Text>
                  <Text variant="body">{model.preview.body}</Text>
                  <Text variant="caption" tone="secondary">{model.preview.recipeVersion}</Text>
                  <Text variant="caption" tone="warning">{t(language, "recipes.builder.preview.disclosure")}</Text>
                </View>
              </Card>
            ) : (
              <Text variant="body" tone="secondary">{t(language, "recipes.builder.preview.locked")}</Text>
            )}
            <Card>
              <View style={styles.stack}>
                <Text variant="h3">{t(language, "recipes.builder.summary.title")}</Text>
                <Text variant="body">{t(language, "recipes.builder.summary.body", {
                  name: model.form.name.trim() || t(language, "recipes.builder.untitled"),
                  opportunityType: selectedOptionLabel(model.opportunityTypes, model.form.opportunityType, (value) => localizedOpportunityType(language, value)),
                  count: model.conditions.length,
                  cadence: model.form.reviewCadenceDays,
                  cooldown: model.form.alertCooldownHours,
                })}</Text>
                {editing ? <Text variant="caption" tone="secondary">{t(language, "recipes.builder.versionNote")}</Text> : null}
                <Text variant="caption" tone="secondary">{t(language, "recipes.builder.summary.meta")}</Text>
              </View>
            </Card>
          </View>
        ) : null}

        <View style={styles.actions}>
          {stepIndex > 0 ? <Button label={t(language, "recipes.builder.action.back")} onPress={onBack} variant="secondary" responsiveWidth="compact-full" testID="recipe-back" /> : null}
          {model.step !== "Review & Outcome" ? (
            <Button label={t(language, "recipes.builder.action.next")} onPress={onContinue} responsiveWidth="compact-full" testID="recipe-continue" />
          ) : (
            <Button label={t(language, editing ? "recipes.builder.action.saveVersion" : "recipes.builder.action.save")} onPress={onSave} loading={saving} disabled={saving} responsiveWidth="compact-full" testID="recipe-save" />
          )}
          <Button label={t(language, "common.cancel")} onPress={onCancel} variant="ghost" responsiveWidth="compact-full" />
        </View>
      </View>
    </WindowPanel>
  );
}

const recipeSteps: readonly RecipeBuilderStep[] = ["Purpose", "Logic", "Risk & Alerts", "Review & Outcome"];

const requiredForStep = (language: AppLanguage, step: RecipeBuilderStep) => {
  switch (step) {
    case "Purpose": return t(language, "recipes.builder.required.purpose");
    case "Logic": return t(language, "recipes.builder.required.logic");
    case "Risk & Alerts": return t(language, "recipes.builder.required.risk");
    case "Review & Outcome": return t(language, "recipes.builder.required.review");
  }
};

const styles = StyleSheet.create((theme) => ({
  stack: { minWidth: 0, gap: theme.spacing.md },
  field: { minWidth: 0, gap: theme.spacing.xs },
  meaning: { minWidth: 0, gap: theme.spacing.xs, borderLeftWidth: theme.strokeWidths.emphasis, borderLeftColor: theme.colors.interactive.primary, padding: theme.spacing.md, backgroundColor: theme.colors.background.surface },
  stepper: { minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.md, padding: theme.spacing.sm, borderRadius: theme.radii.md, backgroundColor: theme.colors.background.surface, borderWidth: theme.strokeWidths.standard, borderColor: theme.colors.border.default },
  actions: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, flexWrap: "wrap", gap: theme.spacing.sm, paddingTop: theme.spacing.xs },
  conditionRow: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, justifyContent: "space-between", alignItems: { compact: "stretch", medium: "center" }, gap: theme.spacing.md },
  conditionCopy: { minWidth: 0, flex: 1, gap: theme.spacing.xs },
}));
