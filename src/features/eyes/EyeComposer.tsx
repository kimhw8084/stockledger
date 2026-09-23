import React from "react";
import { Button, Card, StyleSheet, Text, View } from "../../ui";
import { WindowPanel } from "../../components/WindowPanel";
import { entryRangeFieldErrors } from "../../domain/inputValidation";
import { localizedReviewDateOption, localizedTimeHorizon, t } from "../../lib/i18n";
import type { AppLanguage } from "../../lib/preferences";
import type { Recipe, Stock } from "../../types";
import { AuthoringChoiceField, AuthoringTextField, SearchableOptionField } from "../shared/AuthoringFields";

export interface EyeComposerDraft {
  stockId: string;
  recipeId: string;
  thesisSnapshot: string;
  plannedEntryLow: string;
  plannedEntryHigh: string;
  invalidationRule: string;
  lastReviewedDaysAgo: number;
}

export function EyeComposer({
  language,
  editing,
  draft,
  stocks,
  recipes,
  reviewDates,
  attempted,
  saving,
  onChange,
  onSave,
  onCancel,
  returnFocusRef,
  fallbackFocusRef,
}: {
  language: AppLanguage;
  editing: boolean;
  draft: EyeComposerDraft;
  stocks: readonly Stock[];
  recipes: readonly Recipe[];
  reviewDates: readonly { label: string; daysAgo: number }[];
  attempted: boolean;
  saving: boolean;
  onChange: (change: Partial<EyeComposerDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
  returnFocusRef?: React.RefObject<any>;
  fallbackFocusRef?: React.RefObject<any>;
}) {
  const requiredLabel = t(language, "authoring.required");
  const rangeErrors = entryRangeFieldErrors(draft.plannedEntryLow, draft.plannedEntryHigh);
  const lowError = attempted && rangeErrors.low
    ? t(language, rangeErrors.low === "positive" ? "eyes.create.rangePositive" : "eyes.create.rangeLowOrder")
    : undefined;
  const highError = attempted && rangeErrors.high
    ? t(language, rangeErrors.high === "positive" ? "eyes.create.rangePositive" : "eyes.create.rangeHighOrder")
    : undefined;

  return (
    <WindowPanel
      title={t(language, editing ? "eyes.create.editTitle" : "eyes.create.title")}
      subtitle={t(language, editing ? "eyes.create.editSubtitle" : "eyes.create.subtitle")}
      onClose={onCancel}
      closeLabel={t(language, "common.done")}
      returnFocusRef={returnFocusRef}
      fallbackFocusRef={fallbackFocusRef}
    >
      <View style={styles.stack}>
        <Text variant="body" tone="secondary">{t(language, "eyes.create.persistenceNote")}</Text>

        <Card variant="subtle">
          <View style={styles.stack}>
            <Text variant="h3">{t(language, "authoring.requiredSection")}</Text>
            <SearchableOptionField
              label={t(language, "eyes.create.stock")}
              required
              requiredLabel={requiredLabel}
              options={stocks.map((stock) => ({ value: stock.id, label: stock.symbol, detail: stock.name }))}
              value={draft.stockId}
              onSelect={(stockId) => onChange({ stockId })}
              placeholder={t(language, "eyes.create.selectStock")}
              emptyLabel={t(language, "authoring.noMatches")}
              error={attempted && !draft.stockId ? t(language, "eyes.create.selectStock") : undefined}
              testID="eye-stock"
            />
            <SearchableOptionField
              label={t(language, "eyes.create.recipe")}
              required
              requiredLabel={requiredLabel}
              options={recipes.map((recipe) => ({
                value: recipe.id,
                label: recipe.name,
                detail: localizedTimeHorizon(language, recipe.timeHorizon),
              }))}
              value={draft.recipeId}
              onSelect={(recipeId) => onChange({ recipeId })}
              placeholder={t(language, "eyes.create.selectRecipe")}
              emptyLabel={t(language, "authoring.noMatches")}
              error={attempted && !draft.recipeId ? t(language, "eyes.create.selectRecipe") : undefined}
              testID="eye-recipe"
            />
            <AuthoringTextField
              label={t(language, "eyes.create.thesis")}
              required
              requiredLabel={requiredLabel}
              value={draft.thesisSnapshot}
              onChangeText={(thesisSnapshot) => onChange({ thesisSnapshot })}
              placeholder={t(language, "eyes.create.thesisPlaceholder")}
              multiline
              error={attempted && !draft.thesisSnapshot.trim() ? t(language, "eyes.create.thesisRequired") : undefined}
              testID="eye-thesis"
            />
          </View>
        </Card>

        <Card variant="subtle">
          <View style={styles.stack}>
            <Text variant="h3">{t(language, "authoring.optionalSection")}</Text>
            <Text variant="caption" tone="secondary">{t(language, "eyes.create.optionalNote")}</Text>
            <AuthoringTextField
              label={t(language, "eyes.create.entryLow")}
              value={draft.plannedEntryLow}
              onChangeText={(plannedEntryLow) => onChange({ plannedEntryLow })}
              placeholder={t(language, "eyes.create.entryLowPlaceholder")}
              keyboardType="decimal-pad"
              error={lowError}
              testID="eye-entry-low"
            />
            <AuthoringTextField
              label={t(language, "eyes.create.entryHigh")}
              value={draft.plannedEntryHigh}
              onChangeText={(plannedEntryHigh) => onChange({ plannedEntryHigh })}
              placeholder={t(language, "eyes.create.entryHighPlaceholder")}
              keyboardType="decimal-pad"
              error={highError}
              testID="eye-entry-high"
            />
            <AuthoringChoiceField
              label={t(language, "eyes.create.lastReview")}
              options={reviewDates.map((item) => ({ value: String(item.daysAgo), label: localizedReviewDateOption(language, item.label) }))}
              value={String(draft.lastReviewedDaysAgo)}
              onChange={(value) => onChange({ lastReviewedDaysAgo: Number(value) })}
              testID="eye-last-review"
            />
            <AuthoringTextField
              label={t(language, "eyes.create.invalidation")}
              value={draft.invalidationRule}
              onChangeText={(invalidationRule) => onChange({ invalidationRule })}
              placeholder={t(language, "eyes.create.invalidationPlaceholder")}
              multiline
              testID="eye-invalidation"
            />
          </View>
        </Card>

        <View style={styles.actions}>
          <Button label={t(language, "common.cancel")} onPress={onCancel} variant="secondary" responsiveWidth="compact-full" />
          <Button
            label={editing ? t(language, "common.saveChanges") : t(language, "eyes.create.submit")}
            onPress={onSave}
            loading={saving}
            disabled={saving}
            responsiveWidth="compact-full"
            testID="eye-save"
          />
        </View>
      </View>
    </WindowPanel>
  );
}

const styles = StyleSheet.create((theme) => ({
  stack: { minWidth: 0, gap: theme.spacing.md },
  actions: { minWidth: 0, flexDirection: { compact: "column", medium: "row" }, flexWrap: "wrap", gap: theme.spacing.sm, paddingTop: theme.spacing.xs },
}));
