import React, { useMemo, useRef, useState } from "react";
import type { KeyboardTypeOptions } from "react-native";
import { Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "../../ui";

type SharedFieldProps = {
  label: string;
  requiredLabel?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  disabled?: boolean;
  testID?: string;
};

export function AuthoringTextField({
  label,
  requiredLabel,
  required = false,
  hint,
  error,
  disabled = false,
  testID,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
}: SharedFieldProps & {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
}) {
  return (
    <View style={styles.field}>
      <Text variant="label">
        {label}{required && requiredLabel ? ` · ${requiredLabel}` : ""}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        accessibilityState={{ disabled }}
        aria-invalid={Boolean(error)}
        aria-required={required}
        editable={!disabled}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#64748b"
        testID={testID}
        textAlignVertical={multiline ? "top" : "center"}
        value={value}
        style={[styles.input, multiline && styles.multiline, error && styles.inputInvalid, disabled && styles.disabled]}
      />
      {hint ? <Text variant="caption" tone="secondary">{hint}</Text> : null}
      {error ? <Text accessibilityRole="alert" role="alert" variant="caption" tone="negative">{error}</Text> : null}
    </View>
  );
}

export function AuthoringChoiceField({
  label,
  requiredLabel,
  required = false,
  error,
  disabled = false,
  testID,
  options,
  value,
  onChange,
}: SharedFieldProps & {
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [focusedValue, setFocusedValue] = useState("");
  const optionRefs = useRef<any[]>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const onKeyDown = (index: number, event: { key: string; preventDefault: () => void }) => {
    if (event.key === " " || event.key === "Spacebar" || event.key === "Space" || event.key === "Enter") {
      event.preventDefault();
      const option = options[index];
      if (option) onChange(option.value);
      return;
    }
    let nextIndex = index;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") nextIndex = (index + 1) % options.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") nextIndex = (index - 1 + options.length) % options.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    else return;
    event.preventDefault();
    const next = options[nextIndex];
    if (next) onChange(next.value);
    optionRefs.current[nextIndex]?.focus?.();
  };

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      aria-label={label}
      aria-invalid={Boolean(error)}
      testID={testID}
      style={styles.field}
    >
      <Text variant="label">
        {label}{required && requiredLabel ? ` · ${requiredLabel}` : ""}
      </Text>
      <View style={styles.choiceList}>
        {options.map((option, index) => {
          const checked = option.value === value;
          return (
            <Pressable
              ref={(node) => { optionRefs.current[index] = node; }}
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked, disabled }}
              aria-checked={checked}
              aria-disabled={disabled}
              role="radio"
              tabIndex={index === (selectedIndex >= 0 ? selectedIndex : 0) ? 0 : -1}
              disabled={disabled}
              onFocus={() => setFocusedValue(option.value)}
              onBlur={() => setFocusedValue((current) => current === option.value ? "" : current)}
              {...({ onKeyDown: (event: any) => onKeyDown(index, { key: event?.nativeEvent?.key ?? event?.key, preventDefault: () => event?.preventDefault?.() }) } as any)}
              onPress={() => onChange(option.value)}
              testID={testID ? `${testID}-${index}` : undefined}
              style={({ pressed }: { pressed: boolean }) => [styles.choice, checked && styles.choiceSelected, focusedValue === option.value && styles.choiceFocused, pressed && styles.choicePressed, disabled && styles.disabled]}
            >
              <Text variant="label" tone={checked ? "onPrimary" : "primary"}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text accessibilityRole="alert" role="alert" variant="caption" tone="negative">{error}</Text> : null}
    </View>
  );
}

export function SearchableOptionField({
  label,
  requiredLabel,
  required = false,
  hint,
  error,
  disabled = false,
  testID,
  options,
  value,
  onSelect,
  placeholder,
  emptyLabel,
}: SharedFieldProps & {
  options: readonly { value: string; label: string; detail?: string }[];
  value: string;
  onSelect: (value: string) => void;
  placeholder?: string;
  emptyLabel: string;
}) {
  const selected = options.find((option) => option.value === value);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized || normalized === selected?.label.toLocaleLowerCase()) return options;
    return options.filter((option) => `${option.label} ${option.detail ?? ""}`.toLocaleLowerCase().includes(normalized));
  }, [options, query, selected?.label]);

  return (
    <View style={styles.field}>
      <Text variant="label">
        {label}{required && requiredLabel ? ` · ${requiredLabel}` : ""}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        accessibilityState={{ disabled }}
        role="combobox"
        aria-expanded={open}
        aria-invalid={Boolean(error)}
        aria-required={required}
        editable={!disabled}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChangeText={(nextQuery) => {
          setQuery(nextQuery);
          setOpen(true);
          if (selected && nextQuery !== selected.label) onSelect("");
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        placeholderTextColor="#64748b"
        testID={testID}
        value={query}
        style={[styles.input, error && styles.inputInvalid, disabled && styles.disabled]}
      />
      {selected && !open ? (
        <Text selectable variant="caption" tone="secondary">{selected.label}{selected.detail ? ` · ${selected.detail}` : ""}</Text>
      ) : null}
      {hint ? <Text variant="caption" tone="secondary">{hint}</Text> : null}
      {error ? <Text accessibilityRole="alert" role="alert" variant="caption" tone="negative">{error}</Text> : null}
      {open && !disabled ? (
        <View style={styles.results}>
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {filtered.length ? filtered.map((option) => (
              <Button
                key={option.value}
                accessibilityLabel={option.label}
                testID={testID ? `${testID}-option-${option.value}` : undefined}
                label={option.detail ? `${option.label} · ${option.detail}` : option.label}
                onPress={() => {
                  setQuery(option.label);
                  onSelect(option.value);
                  setOpen(false);
                }}
                variant={option.value === value ? "secondary" : "ghost"}
                fullWidth
              />
            )) : (
              <Text variant="caption" tone="secondary">{emptyLabel}</Text>
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  field: { minWidth: 0, gap: theme.spacing.xs },
  input: {
    width: "100%",
    minHeight: theme.controlHeights.md,
    borderWidth: theme.strokeWidths.standard,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.background.surface,
    color: theme.colors.text.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
  },
  multiline: { minHeight: { compact: 118, medium: 100 }, paddingTop: theme.spacing.md },
  inputInvalid: { borderColor: theme.colors.feedback.negative, borderWidth: theme.strokeWidths.emphasis },
  disabled: { opacity: theme.interactionFeedback.disabledOpacity },
  choiceList: { minWidth: 0, gap: theme.spacing.xs },
  choice: {
    minWidth: 0,
    minHeight: theme.controlHeights.md,
    width: "100%",
    justifyContent: "center",
    borderWidth: theme.strokeWidths.standard,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radii.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.background.surface,
  },
  choiceSelected: { backgroundColor: theme.colors.interactive.primary, borderColor: theme.colors.interactive.primary },
  choiceFocused: { borderColor: theme.colors.border.focus, boxShadow: `0 0 0 ${theme.interactionFeedback.focusRingWidth}px ${theme.colors.border.focus}` },
  choicePressed: { opacity: theme.interactionFeedback.pressedOpacity },
  results: {
    maxHeight: 224,
    minWidth: 0,
    borderWidth: theme.strokeWidths.standard,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radii.md,
    padding: theme.spacing.xs,
    backgroundColor: theme.colors.background.surface,
  },
}));
