import React from "react";
import { Button, Card, StyleSheet, Text, View } from "../../ui";
import { WindowPanel } from "../../components/WindowPanel";
import {
  localizedDecisionAction,
  localizedThesisValidity,
  localizedTiming,
  t,
  type AppLanguage,
} from "../../lib/i18n";
import type { DecisionAction } from "../../types";
import { AuthoringChoiceField, AuthoringTextField, SearchableOptionField } from "../shared/AuthoringFields";

export interface JournalComposerDraft {
  eyeId: string;
  alertId: string;
  action: DecisionAction | "";
  note: string;
  concern: string;
  thesisValid: "" | "Yes" | "Partly" | "No";
  timing: "" | "Early" | "On Time" | "Late";
}

export type JournalValidationSection = "context" | "action" | "note" | "thesis" | "timing" | "";

export function JournalComposer({
  language,
  editing,
  draft,
  eyes,
  actionOptions,
  thesisOptions,
  timingOptions,
  validationSection,
  saving,
  onChange,
  onSave,
  onCancel,
  returnFocusRef,
  fallbackFocusRef,
}: {
  language: AppLanguage;
  editing: boolean;
  draft: JournalComposerDraft;
  eyes: readonly { id: string; label: string; detail: string }[];
  actionOptions: readonly DecisionAction[];
  thesisOptions: readonly ("Yes" | "Partly" | "No")[];
  timingOptions: readonly ("Early" | "On Time" | "Late")[];
  validationSection: JournalValidationSection;
  saving: boolean;
  onChange: (change: Partial<JournalComposerDraft>) => void;
  onSave: () => void;
  onCancel: () => void;
  returnFocusRef?: React.RefObject<any>;
  fallbackFocusRef?: React.RefObject<any>;
}) {
  const requiredLabel = t(language, "authoring.required");
  const sectionError = (section: JournalValidationSection, missing: boolean, key: string) =>
    validationSection === section && missing ? t(language, key) : undefined;
  return (
    <WindowPanel
      title={t(language, editing ? "journal.composer.editTitle" : "journal.composer.title")}
      subtitle={t(language, editing ? "journal.composer.editSubtitle" : "journal.composer.subtitle")}
      onClose={onCancel}
      closeLabel={t(language, "common.done")}
      returnFocusRef={returnFocusRef}
      fallbackFocusRef={fallbackFocusRef}
    >
      <View style={styles.stack}>
        <Text variant="body" tone="secondary">{t(language, "journal.composer.persistenceNote")}</Text>

        <Card variant="subtle">
          <View style={styles.stack}>
            <Text variant="h3">{t(language, "journal.composer.contextSection")}</Text>
            <SearchableOptionField
              label={t(language, "journal.composer.eye")}
              required
              requiredLabel={requiredLabel}
              disabled={editing}
              options={eyes.map((eye) => ({ value: eye.id, label: eye.label, detail: eye.detail }))}
              value={draft.eyeId}
              onSelect={(eyeId) => onChange({ eyeId, alertId: "" })}
              placeholder={t(language, "journal.composer.searchPlaceholder")}
              emptyLabel={t(language, "authoring.noMatches")}
              error={sectionError("context", !draft.eyeId, "journal.composer.selectEye")}
              testID="journal-eye"
            />
            <AuthoringChoiceField
              label={t(language, "journal.composer.action")}
              required
              requiredLabel={requiredLabel}
              options={actionOptions.map((value) => ({ value, label: localizedDecisionAction(language, value) }))}
              value={draft.action}
              onChange={(action) => onChange({ action: action as DecisionAction })}
              error={sectionError("action", !draft.action, "journal.validation.actionRequired")}
              testID="journal-action"
            />
          </View>
        </Card>

        <Card variant="subtle">
          <View style={styles.stack}>
            <Text variant="h3">{t(language, "journal.composer.rationaleSection")}</Text>
            <AuthoringTextField
              label={t(language, "journal.composer.why")}
              required
              requiredLabel={requiredLabel}
              value={draft.note}
              onChangeText={(note) => onChange({ note })}
              placeholder={t(language, "journal.composer.notePlaceholder")}
              multiline
              error={sectionError("note", !draft.note.trim(), "journal.composer.noteRequired")}
              testID="journal-note"
            />
            <AuthoringTextField
              label={t(language, "journal.composer.concern")}
              hint={t(language, "journal.composer.optional")}
              value={draft.concern}
              onChangeText={(concern) => onChange({ concern })}
              placeholder={t(language, "journal.composer.concernPlaceholder")}
              multiline
              testID="journal-concern"
            />
          </View>
        </Card>

        <Card variant="subtle">
          <View style={styles.stack}>
            <Text variant="h3">{t(language, "journal.composer.reviewSection")}</Text>
            <AuthoringChoiceField
              label={t(language, "journal.composer.thesisValidity")}
              required
              requiredLabel={requiredLabel}
              options={thesisOptions.map((value) => ({ value, label: localizedThesisValidity(language, value) }))}
              value={draft.thesisValid}
              onChange={(thesisValid) => onChange({ thesisValid: thesisValid as JournalComposerDraft["thesisValid"] })}
              error={sectionError("thesis", !draft.thesisValid, "journal.validation.thesisRequired")}
              testID="journal-thesis"
            />
            <AuthoringChoiceField
              label={t(language, "journal.composer.timing")}
              required
              requiredLabel={requiredLabel}
              options={timingOptions.map((value) => ({ value, label: localizedTiming(language, value) }))}
              value={draft.timing}
              onChange={(timing) => onChange({ timing: timing as JournalComposerDraft["timing"] })}
              error={sectionError("timing", !draft.timing, "journal.validation.timingRequired")}
              testID="journal-timing"
            />
          </View>
        </Card>

        <View style={styles.actions}>
          <Button label={t(language, "common.cancel")} onPress={onCancel} variant="secondary" responsiveWidth="compact-full" />
          <Button
            label={t(language, editing ? "common.saveChanges" : "journal.action.save")}
            onPress={onSave}
            loading={saving}
            disabled={saving}
            responsiveWidth="compact-full"
            testID="journal-save"
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
